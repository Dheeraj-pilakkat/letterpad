import { StyleSheet } from "@react-pdf/renderer";

/* A4 = 595.28 × 841.89pt. Side margin 50pt (~18mm). */
export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingLeft: 50,
    paddingRight: 50,
    paddingBottom: 64,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#1C2536",
    backgroundColor: "#FFFFFF",
  },

  /* ---- header ---- */
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logo: {
    width: 44,
    height: 44,
    objectFit: "contain",
    marginRight: 12,
  },
  logoCenter: {
    width: 48,
    height: 48,
    objectFit: "contain",
    marginBottom: 8,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  rule: {
    borderBottomWidth: 1.5,
    marginBottom: 14,
  },
  thinRule: {
    borderBottomWidth: 1,
    borderBottomColor: "#E4DDD0",
  },

  /* ---- text roles ---- */
  brand: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  meta: {
    fontSize: 8.2,
    lineHeight: 1.45,
    color: "#5C6470",
  },
  metaRight: {
    fontSize: 8.2,
    lineHeight: 1.45,
    color: "#5C6470",
    textAlign: "right",
  },
  label: {
    fontSize: 7,
    letterSpacing: 0.8,
    color: "#8A8578",
    marginBottom: 2,
  },
  value: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#1C2536",
  },
  docTitle: {
    fontSize: 17,
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 4,
  },
  docSubtitle: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#3D4657",
  },

  /* ---- blocks ---- */
  metaBlock: {
    flexDirection: "row",
    marginTop: 6,
    marginBottom: 4,
  },
  colGrow: {
    flexGrow: 1,
    paddingRight: 16,
  },
  colRight: {
    width: 170,
  },

  /* ---- items table ---- */
  thRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  th: {
    fontSize: 7.5,
    letterSpacing: 0.6,
    color: "#FFFFFF",
  },
  tdRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE7DC",
  },
  td: {
    fontSize: 9,
    lineHeight: 1.4,
  },
  tdNum: {
    fontSize: 9,
    textAlign: "right",
  },

  /* ---- totals ---- */
  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  totalsCol: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 7,
    marginTop: 4,
  },

  /* ---- prose ---- */
  paragraph: {
    fontSize: 10.5,
    lineHeight: 1.6,
    marginBottom: 10,
  },
  subject: {
    fontSize: 11,
    marginBottom: 12,
  },

  /* ---- footer ---- */
  footer: {
    position: "absolute",
    left: 50,
    right: 50,
    bottom: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E4DDD0",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7.5,
    color: "#8A8578",
  },
});
