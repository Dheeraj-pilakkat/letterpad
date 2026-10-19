/* eslint-disable jsx-a11y/alt-text -- @react-pdf has no alt-text support; logo/signature are decorative */
import {
  Document,
  Image,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { DocumentItem, DocumentContent, DocumentStatus, DocumentType, TemplateLayout } from "@/lib/db/types";
import { documentLabel, fontFamilyTokens, templateById } from "@/lib/templates/registry";
import { formatDate, formatMoney } from "@/lib/utils";
import { pdfStyles as s } from "./styles";

/**
 * Structural (ObjectId-free) input types so the component works with DB rows,
 * server-serialized DTOs, and sample fixtures alike.
 */
export interface PdfWorkspace {
  name: string;
  logo?: string;
  signature?: string;
  taxRate?: number;
  /** Full brand palette; first entry is the primary accent */
  brandColors?: string[];
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  bankDetails?: string;
  brandColor: string;
}

export interface PdfDoc {
  number: string;
  type: DocumentType;
  templateId: string;
  status: DocumentStatus;
  title?: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  items: DocumentItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  content: DocumentContent;
  layout: TemplateLayout;
}

export interface PdfContact {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface DocumentPdfProps {
  workspace: PdfWorkspace;
  doc: PdfDoc;
  contact?: PdfContact | null;
}

const st = (style: Style | Style[]): Style | Style[] => style;

function qtyLabel(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 1000) / 1000);
}

function addressLines(parts: Array<string | undefined>): string[] {
  return parts.filter((p): p is string => Boolean(p && p.trim()));
}

function joinContactLines(contact: PdfContact | null | undefined): string[] {
  if (!contact) return [];
  const addr = addressLines([
    contact.addressLine1,
    contact.addressLine2,
    [contact.city, contact.state, contact.postalCode].filter(Boolean).join(" "),
    contact.country,
  ]);
  return [contact.companyName, ...addr].filter((x): x is string => Boolean(x));
}

export function DocumentPdf({ workspace, doc, contact }: DocumentPdfProps) {
  const accent = doc.layout.accentColor || workspace.brandColor || "#1C2536";
  const fonts = fontFamilyTokens(doc.layout.fontPair);
  const template = templateById(doc.templateId);
  const kind = template?.kind ?? (doc.items.length > 0 ? "itemized" : "prose");
  const headerStyle = doc.layout.headerStyle ?? "left";
  const showLogo = doc.layout.showLogo !== false && Boolean(workspace.logo);
  const label = documentLabel(doc.type, doc.templateId);
  const isAmountDue = doc.type === "invoice" || doc.type === "request";

  const businessLines = addressLines([
    workspace.addressLine1,
    workspace.addressLine2,
    [workspace.city, workspace.state, workspace.postalCode]
      .filter(Boolean)
      .join(" "),
    workspace.country,
  ]);
  const businessContact = [
    workspace.email,
    workspace.phone,
    workspace.website,
  ]
    .filter(Boolean)
    .join("  ·  ");

  /* ---------------- header ---------------- */

  const header =
    headerStyle === "banner" ? (
      <View style={[s.banner, st({ backgroundColor: accent })]}>
        {showLogo && workspace.logo ? (
          <Image src={workspace.logo} style={s.logo} />
        ) : null}
        <View style={st({ flexGrow: 1 })}>
          <Text
            style={st([
              s.brand,
              { color: "#FFFFFF", fontFamily: fonts.display },
            ])}
          >
            {workspace.name}
          </Text>
          <Text
            style={st({ fontSize: 7.8, color: "#FFFFFF", opacity: 0.85, marginTop: 2 })}
          >
            {[...businessLines, businessContact].filter(Boolean).join("  ·  ")}
          </Text>
        </View>
      </View>
    ) : headerStyle === "center" ? (
      <View style={st({ alignItems: "center", marginBottom: 14 })}>
        {showLogo && workspace.logo ? (
          <Image src={workspace.logo} style={s.logoCenter} />
        ) : null}
        <Text
          style={st([
            s.brand,
            { fontSize: 16, color: accent, fontFamily: fonts.display },
          ])}
        >
          {workspace.name}
        </Text>
        <Text style={[s.meta, st({ textAlign: "center", marginTop: 3 })]}>
          {businessLines.join(" · ")}
        </Text>
        {businessContact ? (
          <Text style={[s.meta, st({ textAlign: "center" })]}>{businessContact}</Text>
        ) : null}
        <View style={[s.rule, st({ width: 120, borderColor: accent, marginTop: 8, marginBottom: 0 })]} />
      </View>
    ) : (
      <View>
        <View style={s.headerRow}>
          {showLogo && workspace.logo ? (
            <Image src={workspace.logo} style={s.logo} />
          ) : null}
          <View style={s.colGrow}>
            <Text
              style={st([
                s.brand,
                { color: accent, fontFamily: fonts.display },
              ])}
            >
              {workspace.name}
            </Text>
            {businessLines.map((line) => (
              <Text key={line} style={s.meta}>
                {line}
              </Text>
            ))}
            {businessContact ? <Text style={s.meta}>{businessContact}</Text> : null}
          </View>
          {workspace.taxId ? (
            <Text style={s.metaRight}>{workspace.taxId}</Text>
          ) : null}
        </View>
        <View
          style={[
            s.rule,
            st({
              borderColor: accent,
              marginTop: headerStyle === "left" ? 10 : 6,
            }),
          ]}
        />
      </View>
    );

  /* ---------------- recipient + meta ---------------- */

  const recipientLines = joinContactLines(contact);

  const metaBlock = (
    <View style={s.metaBlock}>
      <View style={s.colGrow}>
        <Text style={s.label}>PREPARED FOR</Text>
        {contact ? (
          <>
            <Text style={st([s.value, { fontFamily: fonts.display }])}>
              {contact.name}
            </Text>
            {recipientLines.map((line) => (
              <Text key={line} style={s.value}>
                {line}
              </Text>
            ))}
            {contact.email ? <Text style={s.value}>{contact.email}</Text> : null}
            {contact.phone ? <Text style={s.value}>{contact.phone}</Text> : null}
          </>
        ) : (
          <Text style={st([s.value, { color: "#8A8578" }])}>—</Text>
        )}
      </View>
      <View style={s.colRight}>
        <Text style={[s.label, st({ textAlign: "right" })]}>{label.toUpperCase()} NO.</Text>
        <Text style={st([s.value, { textAlign: "right", fontFamily: fonts.display }])}>
          {doc.number}
        </Text>
        <Text style={[s.label, st({ textAlign: "right", marginTop: 6 })]}>DATE</Text>
        <Text style={st([s.value, { textAlign: "right" }])}>
          {formatDate(doc.issueDate)}
        </Text>
        {doc.dueDate ? (
          <>
            <Text style={[s.label, st({ textAlign: "right", marginTop: 6 })]}>DUE DATE</Text>
            <Text style={st([s.value, { textAlign: "right" }])}>
              {formatDate(doc.dueDate)}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );

  /* ---------------- body ---------------- */

  const cols = {
    qty: doc.layout.columns?.qty !== false,
    unitPrice: doc.layout.columns?.unitPrice !== false,
    tax: doc.layout.columns?.tax !== false,
  };
  const customCols = doc.layout.customColumns ?? [];

  const itemsTable =
    kind === "itemized" ? (
      <View style={st({ marginTop: 14 })}>
        <View style={[s.thRow, st({ backgroundColor: accent })]}>
          <Text style={[s.th, st({ flexGrow: 1, paddingRight: 6 })]}>DESCRIPTION</Text>
          {customCols.map((col) => (
            <Text
              key={col.id}
              style={[
                s.th,
                st({
                  width: col.type === "number" ? 58 : 76,
                  textAlign: col.type === "number" ? "right" : "left",
                  paddingRight: 6,
                }),
              ]}
            >
              {col.label.toUpperCase()}
            </Text>
          ))}
          {cols.qty ? (
            <Text style={[s.th, st({ width: 34, textAlign: "right" })]}>QTY</Text>
          ) : null}
          {cols.unitPrice ? (
            <Text style={[s.th, st({ width: 70, textAlign: "right" })]}>UNIT PRICE</Text>
          ) : null}
          {cols.tax ? (
            <Text style={[s.th, st({ width: 38, textAlign: "right" })]}>TAX</Text>
          ) : null}
          <Text style={[s.th, st({ width: 74, textAlign: "right" })]}>AMOUNT</Text>
        </View>
        {doc.items.map((item, i) => (
          <View
            key={`${item.description}-${i}`}
            style={[
              s.tdRow,
              i % 2 === 1 ? st({ backgroundColor: "#FBFAF7" }) : st({}),
            ]}
          >
            <Text style={[s.td, st({ flexGrow: 1, paddingRight: 6 })]} wrap>
              {item.description}
            </Text>
            {customCols.map((col) => {
              const value = item.values?.[col.id] ?? "";
              return col.type === "number" ? (
                <Text key={col.id} style={[s.tdNum, st({ width: 58 })]}>
                  {value || "—"}
                </Text>
              ) : (
                <Text key={col.id} style={[s.td, st({ width: 76, paddingRight: 6 })]} wrap>
                  {value || "—"}
                </Text>
              );
            })}
            {cols.qty ? (
              <Text style={[s.tdNum, st({ width: 34 })]}>{qtyLabel(item.quantity)}</Text>
            ) : null}
            {cols.unitPrice ? (
              <Text style={[s.tdNum, st({ width: 70 })]}>
                {formatMoney(item.unitPrice, doc.currency)}
              </Text>
            ) : null}
            {cols.tax ? (
              <Text style={[s.tdNum, st({ width: 38 })]}>{qtyLabel(item.taxRate)}%</Text>
            ) : null}
            <Text style={[s.tdNum, st({ width: 74 })]}>
              {formatMoney(item.amount, doc.currency)}
            </Text>
          </View>
        ))}

        <View style={s.totalsWrap}>
          <View style={s.totalsCol}>
            <View style={s.totalRow}>
              <Text style={st({ color: "#5C6470" })}>Subtotal</Text>
              <Text>{formatMoney(doc.subtotal, doc.currency)}</Text>
            </View>
            {doc.taxTotal > 0 ? (
              <View style={s.totalRow}>
                <Text style={st({ color: "#5C6470" })}>Tax</Text>
                <Text>{formatMoney(doc.taxTotal, doc.currency)}</Text>
              </View>
            ) : null}
            <View
              style={[
                s.totalGrand,
                st({ borderTopWidth: 1.5, borderTopColor: accent }),
              ]}
            >
              <Text
                style={st({
                  fontFamily: fonts.display,
                  fontSize: 12,
                  color: accent,
                })}
              >
                {isAmountDue ? "Amount due" : "Total"}
              </Text>
              <Text
                style={st({
                  fontFamily: fonts.display,
                  fontSize: 12,
                  color: accent,
                })}
              >
                {formatMoney(doc.total, doc.currency)}
              </Text>
            </View>
          </View>
        </View>

        {doc.status === "paid" || doc.status === "accepted" ? (
          <Text
            style={st({
              textAlign: "right",
              marginTop: 8,
              fontSize: 9,
              color: "#2F5D50",
            })}
          >
            {doc.status === "paid" ? "Payment received with thanks." : "Accepted — thank you."}
          </Text>
        ) : null}
      </View>
    ) : (
      <View style={st({ marginTop: 12 })}>
        {doc.content.subject ? (
          <Text style={[s.subject, st({ fontFamily: fonts.display })]}>
            {doc.content.subject}
          </Text>
        ) : null}
        {(doc.content.body ?? "").split(/\n{2,}/).map((para, i) =>
          para.trim() ? (
            <Text key={i} style={s.paragraph}>
              {para.trim()}
            </Text>
          ) : null,
        )}
      </View>
    );

  const terms = doc.content.terms?.trim() ? (
    <View style={st({ marginTop: 16 })}>
      <View style={[s.thinRule, st({ marginBottom: 6 })]} />
      <Text style={s.label}>TERMS</Text>
      <Text style={st({ fontSize: 8.5, lineHeight: 1.5, color: "#5C6470" })}>
        {doc.content.terms}
      </Text>
    </View>
  ) : null;

  const bankDetails =
    kind === "itemized" && workspace.bankDetails ? (
      <View
        style={st({
          marginTop: 14,
          padding: 9,
          backgroundColor: "#FAF7F2",
          borderLeftWidth: 2,
          borderLeftColor: accent,
        })}
      >
        <Text style={s.label}>PAYMENT DETAILS</Text>
        <Text style={st({ fontSize: 8.5, lineHeight: 1.5, color: "#3D4657" })}>
          {workspace.bankDetails}
        </Text>
      </View>
    ) : null;

  const signature = doc.layout.showSignature ? (
    <View style={st({ marginTop: 26, width: 200 })}>
      {workspace.signature ? (
        <Image src={workspace.signature} style={st({ width: 120, height: 40, objectFit: "contain" })} />
      ) : (
        <View style={st({ borderBottomWidth: 1, borderBottomColor: "#B7B2A4", width: 150, height: 22 })} />
      )}
      <Text style={st({ fontSize: 8.5, marginTop: 3, color: "#3D4657" })}>
        {workspace.name}
      </Text>
      <Text style={st({ fontSize: 7.5, color: "#8A8578" })}>Authorised signatory</Text>
    </View>
  ) : null;

  /* ---------------- document ---------------- */

  return (
    <Document
      title={`${label} ${doc.number}`}
      author={workspace.name}
      subject={doc.content.subject || label}
    >
      <Page size="A4" style={s.page}>
        {header}
        {metaBlock}
        <Text style={[s.docTitle, st({ fontFamily: fonts.display, color: accent })]}>
          {label.toUpperCase()}
        </Text>
        {doc.title ? <Text style={s.docSubtitle}>{doc.title}</Text> : null}
        {itemsTable}
        {terms}
        {bankDetails}
        {signature}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {workspace.name} · {doc.number}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
