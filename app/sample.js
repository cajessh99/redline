// Synthetic demonstration content for the landing page. Not a real agreement.
// Each flag's `source` must appear verbatim in the clause it points at.

export const parties = 'Northwind Studio ("Client") and Sam Ortiz ("Contractor")';

export const clauses = [
  { id: "3.1", text: "Contractor shall provide the design services described in Schedule A." },
  { id: "3.2", text: "Contractor shall deliver each milestone by the dates set out in Schedule B." },
  {
    id: "4.1",
    text: "Contractor shall invoice Client at the end of each calendar month.",
  },
  {
    id: "4.2",
    text: "Payment for any deliverable is due only upon Client's acceptance of that deliverable, which Client shall grant or withhold in its sole discretion.",
    flag: "pay",
  },
  {
    id: "5.1",
    text: "All work product, including any materials, code, or designs Contractor created before the Effective Date, shall become the sole property of Client upon creation.",
    flag: "ip",
  },
  {
    id: "6.1",
    text: "Client can terminate this Agreement at any time without notice, and shall pay Contractor for work completed through the date of termination.",
    flag: "term",
  },
  { id: "7.1", text: "This Agreement is governed by the laws of the State of Oregon." },
];

// Ranked: Severe before Moderate, then document order.
export const flags = [
  {
    key: "pay",
    tier: "Severe",
    clause: "4.2",
    redLine: "Payment that depends on the client's discretion or on a third party paying first",
    statement:
      "You get paid only if the client accepts the work, and the client alone decides whether to accept it.",
    source:
      "Payment for any deliverable is due only upon Client's acceptance of that deliverable, which Client shall grant or withhold in its sole discretion.",
    counter:
      "Payment for each deliverable is due within thirty (30) days of delivery. Client shall accept a deliverable unless it fails the requirements in Schedule A, and shall state any failure in writing within ten (10) days of delivery.",
  },
  {
    key: "ip",
    tier: "Severe",
    clause: "5.1",
    redLine: "Assignment of IP I created before or outside this engagement",
    statement:
      "The client owns work you made before this contract started, as well as what you make for them.",
    source:
      "All work product, including any materials, code, or designs Contractor created before the Effective Date, shall become the sole property of Client upon creation.",
    counter:
      "Deliverables created under this Agreement become Client's property upon full payment. Materials Contractor created before the Effective Date remain Contractor's property, and Contractor grants Client a non-exclusive license to use them as part of the deliverables.",
  },
  {
    key: "term",
    tier: "Moderate",
    clause: "6.1",
    redLine: "Termination without notice, or without pay for work already done",
    statement:
      "The client can end the contract at any moment, with no notice. You are paid for work done up to that day.",
    source:
      "Client can terminate this Agreement at any time without notice, and shall pay Contractor for work completed through the date of termination.",
    counter:
      "Either party can end this Agreement with fourteen (14) days' written notice. Client shall pay for work completed through the termination date.",
  },
];

export const receipt = [
  "Uncapped indemnity or unlimited liability on me",
  "A non-compete or non-solicit that bars me from other clients",
];

export const defaultRedLines = [
  "Assignment of IP I created before or outside this engagement",
  "Uncapped indemnity or unlimited liability on me",
  "A non-compete or non-solicit that bars me from other clients",
  "Payment that depends on the client's discretion or on a third party paying first",
  "Termination without notice, or without pay for work already done",
];
