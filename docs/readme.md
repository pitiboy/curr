# Community Unified Resource Registry (CURR)

alias

# Közösségi Önjegyző Render (KÖR)

## Unified Data Model

Purpose:
This system manages community-based resource accounting, where members, organizations, locations, and activities interact through multi-currency transactions (money, time, food, goods, etc.).
Each transaction is recorded in a simplified single-entry ledger.

### Use Cases

#### Member Use Cases

- **As a member**, I would like to see my own balance and transaction history.
- **As a member**, I would like to make transactions to the organization fund.

#### Accountant Use Cases

- **As an accountant**, I would like to enter member fees and payments.
- **As an accountant**, I would like to schedule future member fees.
- **As an accountant**, I would like to register new invoices.
- **As an accountant**, I would like to import transactions from a file.

#### Management Use Cases

- **As a project owner**, I would like to see my project balance as a report.
- **As a board member**, I would like to see all project balances across the organization.

#### System Use Cases

- **Expense tracking**: The system can track expenses that belong to specific projects or locations.
- **Multi-currency support**: Transactions can be made in different currencies with automatic conversion.

```mermaid
erDiagram
    %% === Core entities ===
    MEMBER {
        uid id PK
        uid identifier
        string name
        email email
        enum status
    }

    ORGANIZATION {
        uid id PK
        string name
        text description
        text address
    }

    MEMBERSHIP {
        uid id PK
        relation member_id FK
        relation organization_id FK
        enum role
        datetime joined_at
    }

    DIVISION {
        uid id PK
        string name
        text description
        relation organization_id FK
        relation location_id FK
    }

    ACCOUNT {
        uid id PK
        string name
        enum category
        text description
        relation division_id FK
    }

    CURRENCY_TYPE {
        uid id PK
        string code
        string name
        enum category
        string unit
    }

    CURRENCY_RATE {
        uid id PK
        relation from_currency_type FK
        relation to_currency_type FK
        decimal rate
        datetime valid_from
        datetime valid_to
    }

    TRANSACTION_TYPE {
        uid id PK
        string name
        enum category
        text description
    }

    TRANSACTION {
        uid id PK
        datetime date
        decimal amount
        enum direction
        text description
        relation member_id FK
        relation account_id FK
        relation transaction_type_id FK
        relation currency_type_id FK
        relation related_transaction_id FK
    }

    %% === Relations ===
    MEMBER ||--o{ MEMBERSHIP : "member_id"
    ORGANIZATION ||--o{ DIVISION : "organization_id"
    ORGANIZATION ||--o{ MEMBERSHIP : "organization_id"
    DIVISION ||--o{ ACCOUNT : "division_id"
    ACCOUNT ||--o{ TRANSACTION : "account_id"
    MEMBER ||--o{ TRANSACTION : "member_id"
    CURRENCY_TYPE ||--o{ CURRENCY_RATE : "from currency"
    CURRENCY_TYPE ||--o{ CURRENCY_RATE : "to currency"
    TRANSACTION_TYPE ||--o{ TRANSACTION : "transaction_type_id"
    CURRENCY_TYPE ||--o{ TRANSACTION : "currency_type_id"
    TRANSACTION ||--o{ TRANSACTION : "transaction_id"

```

### 💬 Entity Overview

| Entity              | Description                                                                 | Sample Values                                       |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| **Member**          | A community participant (individual).                                       | John Doe, jane@example.com, resident                |
| **Organization**    | Collective entity managing resources and members.                           | Zöld források szövetkezet, Kömlődi állatidomárok    |
| **Membership**      | Relation between a Member and an Organization, storing their role.          | gardener, coordinator, 2024-01-15                   |
| **Division**        | A structured unit of work within an organization, linked to a location.     | Spring Planting, Community Kitchen                  |
| **Account**         | A defined action or operation type (e.g. gardening, maintenance).           | gardening, maintenance, cooking                     |
| **CurrencyType**    | Defines currencies or other measurable resource units (cash, labor, goods). | HUF, HOUR, KG_WHEAT, cash, labor                    |
| **CurrencyRate**    | Defines conversion rates between resource types over time.                  | HUF→EUR: 0.0026, HOUR→HUF: 5000                     |
| **TransactionType** | Categorizes transactions (income, expense, transfer).                       | income, expense, internal                           |
| **Transaction**     | Single-entry record of resource inflow or outflow.                          | +5000 HUF, -2 HOUR, deposit payment, gardening work |

#### Missing items to consider for further addition

- Member's Competencies
