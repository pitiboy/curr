# Community Unified Resource Registry (CURR)

alias

# Közösségi Önjegyző Render (KÖR)

## Unified Data Model

Purpose:
This system manages community-based resource accounting, where members, organizations, locations, and activities interact through multi-currency transactions (money, time, food, goods, etc.).
Each transaction is recorded in a simplified single-entry ledger.

### Use cases

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

    LOCATION {
        uid id PK
        string name
        text description
        text address
        decimal lat
        decimal lng
    }

    PROJECT {
        uid id PK
        string name
        text description
        relation organization_id FK
        relation location_id FK
    }

    ACTIVITY {
        uid id PK
        string name
        enum category
        text description
    }

    CURRENTCY_TYPE {
        uid id PK
        string code
        string name
        enum category
        string unit
    }

    EXCHANGE_RATE {
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
        relation organization_id FK
        relation project_id FK
        relation location_id FK
        relation transaction_type_id FK
        relation currency_type_id FK
        relation related_transaction_id FK
    }

    %% === Relations ===
    MEMBER ||--o{ MEMBERSHIP : "belongs to"
    ORGANIZATION ||--o{ MEMBERSHIP : "has members"
    ORGANIZATION ||--o{ PROJECT : "manages"
    PROJECT ||--o{ TRANSACTION : "records"
    MEMBER ||--o{ TRANSACTION : "initiates"
    LOCATION ||--o{ PROJECT : "hosts"
    LOCATION ||--o{ TRANSACTION : "linked to"
    TRANSACTION_TYPE ||--o{ TRANSACTION : "categorizes"
    CURRENTCY_TYPE ||--o{ TRANSACTION : "uses resource"
    CURRENTCY_TYPE ||--o{ EXCHANGE_RATE : "from currency"
    CURRENTCY_TYPE ||--o{ EXCHANGE_RATE : "to currency"
    TRANSACTION ||--o{ TRANSACTION : "related transaction"

```

### 💬 Entity Overview

| Entity              | Description                                                                 | Sample Values                                       |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| **Member**          | A community participant (individual).                                       | John Doe, jane@example.com, resident                |
| **Organization**    | Collective entity managing resources and members.                           | Zöld források szövetkezet, Kömlődi állatidomárok    |
| **Membership**      | Relation between a Member and an Organization, storing their role.          | gardener, coordinator, 2024-01-15                   |
| **Location**        | Physical or logical place where activities or transactions occur.           | Central Park, 47.4979°N, 19.0402°E                  |
| **Project**         | A structured unit of work within an organization, linked to a location.     | Spring Planting, Community Kitchen                  |
| **Activity**        | A defined action or operation type (e.g. gardening, maintenance).           | gardening, maintenance, cooking                     |
| **TaskRole**        | Describes functional roles like "gardener", "accountant", etc.              | gardener, accountant, coordinator                   |
| **ResourceType**    | Defines currencies or other measurable resource units (cash, labor, goods). | HUF, HOUR, KG_WHEAT, cash, labor                    |
| **ExchangeRate**    | Defines conversion rates between resource types over time.                  | HUF→EUR: 0.0026, HOUR→HUF: 5000                     |
| **TransactionType** | Categorizes transactions (income, expense, transfer).                       | income, expense, internal                           |
| **Transaction**     | Single-entry record of resource inflow or outflow.                          | +5000 HUF, -2 HOUR, deposit payment, gardening work |
| **LedgerView**      | Aggregated financial/resource state per org or project.                     | Balance: 15000 HUF, 25 HOUR                         |

#### Missing items to consider for further addition

- Member's Competencies
