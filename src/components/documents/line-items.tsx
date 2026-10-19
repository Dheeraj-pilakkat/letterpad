"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import type { CustomColumn, LineItemColumns } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn, formatMoney, round2 } from "@/lib/utils";
import { computeTotals } from "@/lib/validation/schemas";

export interface ItemDraft {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  /** Custom column values keyed by CustomColumn.id */
  values?: Record<string, string>;
}

const MAX_ITEMS = 200;
export const MAX_CUSTOM_COLUMNS = 4;

/** Common tax rates (GST-style) offered as one-click presets per row. */
const TAX_PRESETS = [0, 5, 12, 18, 28];

export function resolveColumns(columns?: LineItemColumns): Required<LineItemColumns> {
  return {
    qty: columns?.qty ?? true,
    unitPrice: columns?.unitPrice ?? true,
    tax: columns?.tax ?? true,
  };
}

function makeColumnId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `col-${rand}`.slice(0, 40);
}

function emptyItem(defaultTaxRate: number): ItemDraft {
  return {
    description: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: Math.min(Math.max(defaultTaxRate, 0), 100),
  };
}

/**
 * Number input that keeps free-typing state (so "1.25" and clearing the field
 * behave sanely) and normalizes to a number on blur.
 */
function NumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  align = "right",
  ariaLabel,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  step?: string;
  align?: "left" | "right";
  ariaLabel: string;
}) {
  const [text, setText] = useState(String(value));
  // adjust local text when the row is replaced externally (duplicate / reorder),
  // unless the user is currently typing in this field
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    const focusedHere =
      typeof document !== "undefined" &&
      document.activeElement?.getAttribute("aria-label") === ariaLabel;
    if (!focusedHere) setText(String(value));
  }

  function commit(raw: string) {
    let n = Number(raw);
    if (!Number.isFinite(n)) n = 0;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    n = round2(n);
    setText(String(n));
    onCommit(n);
  }

  return (
    <Input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step ?? "any"}
      value={text}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn("h-9", align === "right" && "text-right")}
    />
  );
}

export function LineItems({
  items,
  onChange,
  currency,
  defaultTaxRate = 0,
  columns,
  customColumns,
  onCustomColumnsChange,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  currency: string;
  defaultTaxRate?: number;
  columns?: LineItemColumns;
  customColumns: CustomColumn[];
  onCustomColumnsChange: (cols: CustomColumn[]) => void;
}) {
  const cols = resolveColumns(columns);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<"text" | "number">("text");

  function update(index: number, patch: Partial<ItemDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateValue(index: number, columnId: string, value: string) {
    onChange(
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              values: { ...(item.values ?? {}), [columnId]: value },
            }
          : item,
      ),
    );
  }

  function add(focusLast = false) {
    if (items.length >= MAX_ITEMS) return;
    onChange([...items, emptyItem(defaultTaxRate)]);
    if (focusLast) {
      // let the new row mount, then focus its description field
      requestAnimationFrame(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>(
          'input[aria-label^="Line "][aria-label$="description"]',
        );
        inputs[inputs.length - 1]?.focus();
      });
    }
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function duplicate(index: number) {
    if (items.length >= MAX_ITEMS) return;
    const copy = { ...items[index], values: items[index].values ? { ...items[index].values } : undefined };
    onChange([...items.slice(0, index + 1), copy, ...items.slice(index + 1)]);
  }

  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(to, 0, row);
    onChange(next);
  }

  function addColumn() {
    const label = newLabel.trim();
    if (!label || customColumns.length >= MAX_CUSTOM_COLUMNS) return;
    onCustomColumnsChange([
      ...customColumns,
      { id: makeColumnId(), label: label.slice(0, 40), type: newType },
    ]);
    setNewLabel("");
    setNewType("text");
    setAddingColumn(false);
  }

  function removeColumn(id: string) {
    const label = customColumns.find((c) => c.id === id)?.label ?? "column";
    if (!confirm(`Remove the "${label}" column? Values in it will be deleted.`))
      return;
    onCustomColumnsChange(customColumns.filter((c) => c.id !== id));
    onChange(
      items.map((item) => {
        if (!item.values || !(id in item.values)) return item;
        const values = { ...item.values };
        delete values[id];
        return Object.keys(values).length > 0 ? { ...item, values } : { ...item, values: undefined };
      }),
    );
  }

  const totals = computeTotals(items);

  // tax breakdown by rate, e.g. "18% × ₹9,350"
  const taxGroups = new Map<number, number>();
  for (const item of items) {
    const net = round2(item.quantity * item.unitPrice);
    taxGroups.set(
      item.taxRate,
      round2((taxGroups.get(item.taxRate) ?? 0) + (net * item.taxRate) / 100),
    );
  }
  const taxLines = [...taxGroups.entries()].filter(([rate]) => rate > 0);

  // description + amount are structural; qty / unit price / tax are toggleable;
  // custom columns are user-defined
  const colCount =
    3 +
    Number(cols.qty) +
    Number(cols.unitPrice) +
    Number(cols.tax) +
    customColumns.length;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="w-8 pb-2 font-medium">#</th>
              <th className="pb-2 pr-2 font-medium">Description</th>
              {customColumns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "pb-2 pr-2 font-medium",
                    col.type === "number" ? "w-24 text-right" : "w-32",
                  )}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.label}
                    <button
                      type="button"
                      onClick={() => removeColumn(col.id)}
                      aria-label={`Remove column ${col.label}`}
                      title={`Remove "${col.label}" column`}
                      className="-my-1 rounded p-1 text-muted hover:text-red"
                    >
                      <span aria-hidden className="text-sm leading-none">
                        ×
                      </span>
                    </button>
                  </span>
                </th>
              ))}
              {cols.qty ? (
                <th className="w-20 pb-2 pr-2 text-right font-medium">Qty</th>
              ) : null}
              {cols.unitPrice ? (
                <th className="w-28 pb-2 pr-2 text-right font-medium">Unit price</th>
              ) : null}
              {cols.tax ? (
                <th className="w-32 pb-2 pr-2 text-right font-medium">Tax %</th>
              ) : null}
              <th className="w-32 pb-2 pr-2 text-right font-medium">Amount</th>
              <th className="w-28 pb-2" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-8 text-center text-sm text-muted">
                  No line items yet.
                  <div className="mt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => add(true)}>
                      <Plus size={14} /> Add your first line
                    </Button>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, i) => {
                const net = round2(item.quantity * item.unitPrice);
                const tax = round2((net * item.taxRate) / 100);
                return (
                  <tr key={i} className="border-b border-line/60 align-top">
                    <td className="py-1.5 pr-1 pt-3 text-xs tabular-nums text-muted">
                      {i + 1}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Input
                        value={item.description}
                        onChange={(e) => update(i, { description: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && i === items.length - 1) {
                            e.preventDefault();
                            add(true);
                          }
                        }}
                        placeholder="Brand identity design"
                        className="h-9"
                        aria-label={`Line ${i + 1} description`}
                      />
                    </td>
                    {customColumns.map((col) => (
                      <td key={col.id} className="py-1.5 pr-2">
                        {col.type === "number" ? (
                          <NumberInput
                            value={Number(item.values?.[col.id]) || 0}
                            onCommit={(n) => updateValue(i, col.id, String(n))}
                            step="0.01"
                            ariaLabel={`Line ${i + 1} ${col.label}`}
                          />
                        ) : (
                          <Input
                            value={item.values?.[col.id] ?? ""}
                            onChange={(e) => updateValue(i, col.id, e.target.value)}
                            placeholder={col.label}
                            className="h-9"
                            aria-label={`Line ${i + 1} ${col.label}`}
                          />
                        )}
                      </td>
                    ))}
                    {cols.qty ? (
                      <td className="py-1.5 pr-2">
                        <NumberInput
                          value={item.quantity}
                          onCommit={(n) => update(i, { quantity: n })}
                          min={0.01}
                          ariaLabel={`Line ${i + 1} quantity`}
                        />
                      </td>
                    ) : null}
                    {cols.unitPrice ? (
                      <td className="py-1.5 pr-2">
                        <NumberInput
                          value={item.unitPrice}
                          onCommit={(n) => update(i, { unitPrice: n })}
                          min={0}
                          ariaLabel={`Line ${i + 1} unit price`}
                          step="0.01"
                        />
                      </td>
                    ) : null}
                    {cols.tax ? (
                      <td className="py-1.5 pr-2">
                        <NumberInput
                          value={item.taxRate}
                          onCommit={(n) => update(i, { taxRate: n })}
                          min={0}
                          max={100}
                          step="0.01"
                          ariaLabel={`Line ${i + 1} tax rate`}
                        />
                        <div className="mt-1 flex flex-wrap justify-end gap-1">
                          {TAX_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => update(i, { taxRate: preset })}
                              aria-label={`Set line ${i + 1} tax to ${preset}%`}
                              className={cn(
                                "rounded-[2px] border px-2 py-1 text-[10px] leading-none transition-colors",
                                item.taxRate === preset
                                  ? "border-copper bg-copper/10 text-copper"
                                  : "border-line text-muted hover:border-ink/40",
                              )}
                            >
                              {preset}%
                            </button>
                          ))}
                        </div>
                      </td>
                    ) : null}
                    <td className="py-1.5 pr-2 text-right text-sm tabular-nums text-ink">
                      {formatMoney(net, currency)}
                      {cols.tax && tax > 0 ? (
                        <span className="mt-0.5 block text-[11px] font-normal text-muted">
                          + {formatMoney(tax, currency)} tax
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center justify-end gap-0.5 pt-1.5">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move line ${i + 1} up`}
                          className="rounded p-2 text-muted hover:text-ink disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === items.length - 1}
                          aria-label={`Move line ${i + 1} down`}
                          className="rounded p-2 text-muted hover:text-ink disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicate(i)}
                          disabled={items.length >= MAX_ITEMS}
                          aria-label={`Duplicate line ${i + 1}`}
                          className="rounded p-2 text-muted hover:text-ink disabled:opacity-30"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          aria-label={`Remove line ${i + 1}`}
                          className="rounded p-2 text-muted hover:text-red"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => add()}
              disabled={items.length >= MAX_ITEMS}
            >
              <Plus size={14} /> Add line
            </Button>

            {addingColumn ? (
              <span className="inline-flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addColumn();
                    }
                    if (e.key === "Escape") setAddingColumn(false);
                  }}
                  placeholder="Column name (e.g. Discount)"
                  maxLength={40}
                  aria-label="New column name"
                  className="h-8 w-52 rounded-[3px] border border-line bg-white px-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-copper focus:outline-none"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "text" | "number")}
                  aria-label="New column type"
                  className="h-8 rounded-[3px] border border-line bg-white px-2 text-sm text-ink focus:border-copper focus:outline-none"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  onClick={addColumn}
                  disabled={!newLabel.trim()}
                >
                  Add column
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingColumn(false)}
                >
                  Cancel
                </Button>
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddingColumn(true)}
                disabled={customColumns.length >= MAX_CUSTOM_COLUMNS}
                title={
                  customColumns.length >= MAX_CUSTOM_COLUMNS
                    ? `Max ${MAX_CUSTOM_COLUMNS} custom columns`
                    : "Add your own column"
                }
              >
                <Plus size={14} /> Custom column
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted">
            Tip: press Enter in the last description to add another line. Custom
            columns print on the PDF — up to {MAX_CUSTOM_COLUMNS}.
            {items.length >= MAX_ITEMS ? ` Max ${MAX_ITEMS} lines reached.` : ""}
          </p>
        </div>
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <span className="tabular-nums text-ink">
              {formatMoney(totals.subtotal, currency)}
            </span>
          </div>
          {taxLines.map(([rate, amount]) => (
            <div key={rate} className="flex justify-between text-muted">
              <span>Tax {rate}%</span>
              <span className="tabular-nums text-ink">
                {formatMoney(amount, currency)}
              </span>
            </div>
          ))}
          {taxLines.length === 0 ? (
            <div className="flex justify-between text-muted">
              <span>Tax</span>
              <span className="tabular-nums text-ink">
                {formatMoney(totals.taxTotal, currency)}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-1.5 font-medium text-copper">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
