> **To fill in before publishing:** replace every `[TO BE FILLED: …]` marker with the real details, then delete this paragraph. This text is a template, not legal advice; have it reviewed by a data protection professional before going live.

## 1. Data controller

| Item | Value |
| --- | --- |
| Name | [TO BE FILLED: full name of the operating organisation or person] |
| Registered office / address | [TO BE FILLED: registered office or postal address] |
| Registration number / tax number | [TO BE FILLED: company registration number, registry number or tax number] |
| Representative | [TO BE FILLED: name of the representative] |
| Contact email | [TO BE FILLED: email address for data protection enquiries] |
| Data protection officer | [TO BE FILLED: name and contact details, or "not appointed"] |

Hereinafter: the **Operator**, **we** or **us**.

## 2. The service in brief

**KÖR – Community Unified Resource Registry** (Hungarian: Közösségi Önjegyző Rendszer, CURR) is a restricted-access ledger available at [https://kor.fejlesztesek.hu](https://kor.fejlesztesek.hu). It records the financial and other resource flows of communities and organisations (for example money, working hours or produce) using double-entry bookkeeping, together with the supporting documents.

- **Backoffice:** [https://kor.fejlesztesek.hu/backoffice/](https://kor.fejlesztesek.hu/backoffice/) – recording, reviewing and finalising transactions.
- **Administration panel:** [https://kor.fejlesztesek.hu/admin](https://kor.fejlesztesek.hu/admin) – for operators and developers.

There is **no public sign-up**. User accounts are created only by the Operator's administrator, who also assigns the role (data entry or editor).

## 3. What personal data we process

### 3.1 User account

- email address,
- username (for Google sign-in, the part of the email address before the @),
- a cryptographic hash of the password – only for email + password sign-in; we never store the password itself,
- the sign-in method (local password or Google),
- role (data entry or editor) and account status (active, blocked),
- the time the account was created and last modified.

### 3.2 Signing in with Google

If you use the "Sign in with Google" button, Google shares with us, after your consent, **only your email address and whether it is verified** (`email` scope). We use it to identify your existing account.

- We do not request access to your Gmail, contacts, calendar, Google Drive or any other Google service.
- We never see or store your Google password.
- The access token issued by Google is used only at the moment of sign-in, to look up your email address, and is not stored.

### 3.3 Session and browser storage

- **Session cookie:** a technical cookie required to complete sign-in securely.
- **Browser local storage (localStorage):** the access token received after sign-in and basic user details (ID, email, username, role), as well as interface settings (for example language, theme, list view).
- **Session storage (sessionStorage):** a temporary value marking an ongoing Google sign-in.

We do not use analytics, advertising or tracking cookies, and we do not profile visitors.

### 3.4 Content recorded in the system

- **Transactions:** date, amount, currency, description, the accounts and organisation involved, and **which user entered and finalised them**, and when.
- **Documents:** the uploaded file (invoice, receipt, contract etc.), the name of the vendor or partner, the amount, the date and the description. A document may contain personal data of third parties (for example a private individual seller).
- **Member register:** the names, email addresses and identifiers of the community's members, their membership details (organisation, membership type, validity) and their account.

### 3.5 Server logs

The hosting servers keep technical logs of requests (IP address, time, requested URL, browser type, response code). We use them for troubleshooting and to prevent abuse.

## 4. Purposes and legal bases

| Purpose | Data | Legal basis (GDPR Art. 6(1)) |
| --- | --- | --- |
| Sign-in and access control | 3.1, 3.2, 3.3 | (f) legitimate interest: only authorised people may use the system [TO BE FILLED: if use is based on membership or employment, (b) may also apply] |
| Financial records and retention of documents | 3.4 transactions and documents | (c) legal obligation under Hungarian Act C of 2000 on Accounting [TO BE FILLED: check whether it applies to the organisation], otherwise (f) legitimate interest |
| Who entered and finalised what (accountability, auditability) | entering and finalising user, timestamps | (f) legitimate interest: integrity of the records |
| Member register | 3.4 member register | (b) performance of the membership relationship [TO BE FILLED: reference to the articles of association or membership agreement] |
| Operational security, abuse prevention | 3.5 | (f) legitimate interest |

You may object at any time to processing based on legitimate interest (see section 9).

## 5. Use of data received from Google

We use the data received through Google APIs (your email address) **solely to sign you in and identify your account**. We do not sell it, we do not share it with third parties, we do not use it for advertising, and no human reads it unless you consent, or it is necessary for security reasons or required by law.

The use and transfer of information received from Google APIs to any other app will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

## 6. Who can access the data

- **The Operator's administrators** – full access, to the extent needed to run the service.
- **Users of the system** – according to their role, they see transactions, documents and the names of the users who entered and finalised them.
- **Processors:**

| Processor | Task | Location |
| --- | --- | --- |
| [TO BE FILLED: hosting provider name and registered office] | running the server and website, server logs | [TO BE FILLED: country] |
| [TO BE FILLED: database provider name, if different from the host] | database storage | [TO BE FILLED: country] |
| Cloudinary ([cloudinary.com](https://cloudinary.com)) | storage of uploaded document files | [TO BE FILLED: storage region; if outside the EEA, the transfer mechanism, e.g. standard contractual clauses] |

- **Google** acts as an independent controller during Google sign-in; see [Google's Privacy Policy](https://policies.google.com/privacy).

We do not sell personal data and do not share it for advertising.

## 7. How long we keep the data

| Data | Retention period |
| --- | --- |
| User account | until access ends, then [TO BE FILLED: e.g. 30 days] |
| Transactions, documents, entering and finalising user | **at least 8 years**, as required for accounting documents (Hungarian Act C of 2000, section 169), otherwise [TO BE FILLED] |
| Member register | [TO BE FILLED: period] after the membership ends |
| Server logs | [TO BE FILLED: e.g. 30 days, according to the hosting provider's settings] |
| Data stored in the browser | until you sign out or clear it from your browser |

## 8. Security

- All connections are encrypted (HTTPS).
- Passwords are stored only as cryptographic hashes.
- Access is role-based; finalised transactions cannot be changed afterwards.
- Only an administrator can create accounts.

## 9. Your rights

Regarding the processing of your personal data, you have the right to:

- **access** the data we hold about you,
- request **rectification** of your data,
- request **erasure** of your data, unless an obligation requires us to keep it (for example for accounting documents),
- request **restriction** of processing,
- **data portability**,
- **object** to processing based on legitimate interest.

Send your request to [TO BE FILLED: contact email address]. We will reply within one month at the latest.

You can revoke the access granted for Google sign-in at any time in your Google Account: [https://myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## 10. Remedies

If you believe your data protection rights have been infringed, you can lodge a complaint with the Hungarian supervisory authority, the **Nemzeti Adatvédelmi és Információszabadság Hatóság** (NAIH – Hungarian National Authority for Data Protection and Freedom of Information):

- address: 1055 Budapest, Falk Miksa utca 9–11., Hungary
- postal address: 1363 Budapest, Pf. 9., Hungary
- email: ugyfelszolgalat@naih.hu
- website: [https://naih.hu](https://naih.hu)

You may also lodge a complaint with the supervisory authority of your EU country of residence, or bring the matter before a court.

## 11. Changes to this policy

We update this policy when the service changes. The current version is always available at [https://kor.fejlesztesek.hu/legal/privacy-policy?locale=en](https://kor.fejlesztesek.hu/legal/privacy-policy?locale=en). This is a translation; in case of any discrepancy the [Hungarian version](https://kor.fejlesztesek.hu/legal/privacy-policy) prevails.

**Effective from:** [TO BE FILLED: effective date, e.g. 20 October 2026]
