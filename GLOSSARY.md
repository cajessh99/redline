# Glossary

Terms as Redline uses them. Terms here describe the domain, not the implementation.

## Primary reader
The person every default in the product is written for: an occasional freelancer holding a
client contract they have not signed yet. "Occasional" means they sign a few contracts a year
and have no baseline for what is normal. Other readers are welcome, but when two choices
conflict, the primary reader wins.
Avoid: "user" when the segment matters; "customer" (nobody pays in this version);
"small-business owner" as a synonym (they are an accepted reader, not the primary one).

## Accepted reader
Someone Redline analyses documents for without tailoring its defaults to them: an employee with
an offer letter or non-compete, a renter with a lease, a small-business owner with a vendor or
supplier contract. They get the same analysis as the primary reader.

## Client contract
The document the primary reader uploads: an agreement a client has asked a freelancer to sign.
One of the accepted document types.

## Accepted document type
A kind of document Redline will analyse: a client contract, a vendor or supplier contract, an
employment offer or non-compete, or a lease. Terms of service are not an accepted document type.

## Take-it-or-leave-it document
A document the reader can sign or walk away from but cannot negotiate: a gym membership, a
subscription agreement, terms of service. Redline does not serve readers holding one, because a
counter-offer has no one to receive it.

## Red line
A term the reader will not accept in a contract. The reader keeps an editable list of them, and
only a clause that matches a red line on the list is flagged. There is no other source of flags.

## Default red lines
The red lines Redline ships switched on for a new reader: five terms that take something
unrecoverable from a freelancer. They are the product's own opinion of what is dangerous, and the
reader may edit or delete them.

## Offered red lines
Red lines Redline knows about and shows the reader, but ships switched off. Switching one on
makes it part of the rulebook.

## Flag
A clause in the uploaded document that matches a red line, shown with its severity tier and the
exact sentence it came from. A flag without its source sentence does not exist.

## Severity tier
How much a flagged clause could cost the reader, measured by what they cannot get back. Three
values, no numbers:
- **Severe**: takes something unrecoverable (ownership of prior work, unlimited liability, the
  right to work for others, payment for delivered work).
- **Moderate**: a bounded cost in money or time.
- **Minor**: friction the reader can live with.
Avoid: "risk score", "unusual" (a claim about other contracts, which Redline does not make).

## Party
One of the named sides in a document: Client and Contractor, Landlord and Tenant, Employer and
Employee. The reader picks which party they are before analysis, and every flag, counter-offer,
and answer is from that party's side. Redline never infers the reader's party.

## Receipt
The result for a document in which few or no red lines matched: one line per red line showing
the flag, or the sentence that addresses the topic, or the statement that the document does not
mention it. A receipt is not a declaration that the document is safe.
Avoid: "clean", "no issues", "safe".

## Source sentence
The exact sentence in the stored document text that a flag came from. It must match the stored
text exactly, and the reader sees it beside the flag.
