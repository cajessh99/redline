// Candidate party extraction against real contract openings: both fixtures, a lease, an employment
// offer, a contract that defines no parties, and openings full of defined terms that are not parties.
import { describe, expect, it } from "vitest";
import { normaliseText } from "../../lib/intake/normalise.ts";
import { findPartyCandidates, PARTY_SCAN_CHARS } from "../../lib/intake/parties.ts";
import { loadContract } from "../support/fake-model.ts";

describe("findPartyCandidates", () => {
  it("finds exactly Client and Contractor in the one-sided fixture, as its sidecar lists them", () => {
    const { text, sidecar } = loadContract("one-sided-services-agreement");
    expect(findPartyCandidates(text)).toEqual(["Client", "Contractor"]);
    expect(sidecar.parties).toEqual(["Client", "Contractor"]);
  });

  it("finds exactly Client and Contractor in the benign fixture", () => {
    const { text } = loadContract("benign-services-agreement");
    expect(findPartyCandidates(text)).toEqual(["Client", "Contractor"]);
  });

  it("finds Landlord and Tenant in a lease opening with curly quotes and hereinafter", () => {
    const text = normaliseText(
      [
        "RESIDENTIAL LEASE AGREEMENT",
        "",
        "This Residential Lease Agreement (this “Lease”) is made on June 1, 2026, between Harlow Property Group LLC, hereinafter referred to as the “Landlord”, and Priya Venn, hereinafter “Tenant”, for the premises at 12 Ash Court, Unit 4 (the “Premises”).",
        "",
        "1. Rent. Tenant shall pay rent of $1,450 on the first day of each month.",
      ].join("\n"),
    );
    expect(findPartyCandidates(text)).toEqual(["Landlord", "Tenant"]);
  });

  it("finds the parties in a lease that brackets hereinafter", () => {
    const text = "LEASE\n\nThis lease is between Ann Cole (hereinafter \"Lessor\") and Ben Ruiz (hereinafter called the \"Lessee\").";
    expect(findPartyCandidates(text)).toEqual(["Lessor", "Lessee"]);
  });

  it("finds Company and Employee in an employment offer letter with no 'between'", () => {
    const text = normaliseText(
      [
        "OFFER OF EMPLOYMENT",
        "",
        "Dear Sam,",
        "",
        "Brightwell Foods Inc. (the \"Company\") is pleased to offer you, Sam Okafor (\"Employee\"), the position of Operations Analyst, starting on January 5, 2027 (the \"Start Date\"), on the terms in this letter (this \"Offer Letter\").",
        "",
        "Employee agrees that for twelve months after employment ends, Employee shall not work for a competitor of the Company.",
      ].join("\n"),
    );
    expect(findPartyCandidates(text)).toEqual(["Company", "Employee"]);
  });

  it("finds parties named by something other than a role word when they follow 'between' and a name", () => {
    const text =
      "This Supply Agreement (the \"Agreement\") is made between Northgate Mills Ltd. (\"Northgate\") and Pellow & Daughters (\"Pellow\").";
    expect(findPartyCandidates(text)).toEqual(["Northgate", "Pellow"]);
  });

  it("returns nothing for a contract that defines no parties", () => {
    const text = normaliseText(
      [
        "WEBSITE DESIGN TERMS",
        "",
        "Alex Moreno will design a five page website for Fernhill Bakery. Fernhill Bakery will pay $3,000, half before work starts and half on delivery.",
        "",
        "Either side can end this arrangement with two weeks' written notice.",
      ].join("\n"),
    );
    expect(findPartyCandidates(text)).toEqual([]);
  });

  it("leaves out defined terms that are not parties", () => {
    const text = normaliseText(
      [
        "MASTER SERVICES AGREEMENT",
        "",
        "This Master Services Agreement (the \"Agreement\") takes effect on May 1, 2026 (the \"Effective Date\") and runs for one year (the \"Term\").",
        "",
        "\"Services\" means the work in each statement of work (each a \"Statement of Work\"). The work product (the \"Deliverables\"), the fees (the \"Fees\") and any non-public information (\"Confidential Information\") are described in each Statement of Work.",
      ].join("\n"),
    );
    expect(findPartyCandidates(text)).toEqual([]);
  });

  it("leaves out non-party terms defined in the parties' own paragraph", () => {
    const text =
      "This Agreement is made between Acme Studio LLC (\"Agency\") and Jo Park (\"Consultant\") for the Website Project (the \"Project\") starting on the Start Date (the \"Effective Date\").";
    expect(findPartyCandidates(text)).toEqual(["Agency", "Consultant"]);
  });

  it("de-duplicates and keeps the order of first appearance", () => {
    const text =
      "Between Rowe Ltd (\"Supplier\") and Dane Co. (\"Customer\"). Rowe Ltd, a Delaware company (the \"Supplier\"), and Dane Co. (the 'Customer').";
    expect(findPartyCandidates(text)).toEqual(["Supplier", "Customer"]);
  });

  it("does not offer a role word that is only used, never defined", () => {
    const text = "The Client shall pay the Contractor within 30 days. The Landlord keeps the deposit.";
    expect(findPartyCandidates(text)).toEqual([]);
  });

  it("scans only the opening of the text", () => {
    const filler = "Nothing here defines a party. ".repeat(Math.ceil(PARTY_SCAN_CHARS / 30) + 1);
    const text = `${filler}\n\nThis agreement is between Ada Grey (\"Licensor\") and Ivo Lund (\"Licensee\").`;
    expect(findPartyCandidates(text)).toEqual([]);
  });
});
