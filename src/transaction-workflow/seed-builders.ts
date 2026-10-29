/**
 * Kor ügylet 1–9 sablon definíciók (docs/plans/0002 §8).
 * lekotesSteps / forintRevenueSteps: explicit workflow.step sorok (nincs implicit 1900 bontás).
 * korTransactionWorkflowSeeds(): forrás a JSON exportnak és fallback, ha nincs fájl a seed mappában.
 */
export type SeedStep = {
  description: string;
  percent: number;
  debit_code: string;
  credit_code: string;
  currency: string;
  organization: string;
  transaction_type?: string;
  copy_receipt?: boolean;
};

export type SeedWorkflow = {
  name: string;
  debit_account_code: number;
  credit_account_code: number;
  currency?: string | null;
  transaction_type?: string | null;
  keep_original?: boolean;
  steps_published?: boolean;
  steps: SeedStep[];
};

const TREASURY = 'I/3. Pénzügyi Igazgatóság';
const RESIDENTIAL = 'I/4.11.1.1 Lakóterületek';
const CROPLAND = 'I/4.11.1.2 Termőterületek';
const LIVESTOCK = 'I/4.12.1.2 Állattenyésztés';
const ORCHARD = 'I/4.12.1.1.1 Szávai Márton gyümölcsfaliget';
const HENHOUSE = 'Tojóól';

export function lekotesSteps(options: {
  hufPercent: number;
  korPercent: number;
  assetCode: string;
  assetOrganization: string;
  treasuryOrganization?: string;
}): SeedStep[] {
  const treasury = options.treasuryOrganization ?? TREASURY;
  return [
    {
      description: 'Lekötés 1 HUF fedezet',
      percent: options.hufPercent,
      debit_code: '1900',
      credit_code: options.assetCode,
      currency: 'HUF',
      organization: options.assetOrganization,
      transaction_type: 'Átvezetés',
    },
    {
      description: 'Lekötés 2 KOR kibocsátás',
      percent: options.korPercent,
      debit_code: '1000',
      credit_code: '1900',
      currency: 'KOR',
      organization: treasury,
      transaction_type: 'Átvezetés',
    },
    {
      description: 'Lekötés 3 KOR le',
      percent: options.korPercent,
      debit_code: '1900',
      credit_code: '1000',
      currency: 'KOR',
      organization: treasury,
      transaction_type: 'Átvezetés',
    },
    {
      description: 'Lekötés 4 KOR cél',
      percent: options.korPercent,
      debit_code: '1000',
      credit_code: '1900',
      currency: 'KOR',
      organization: options.assetOrganization,
      transaction_type: 'Átvezetés',
    },
  ];
}

export function forintRevenueSteps(options: {
  percent: number;
  cashCode?: string;
  revenueCode: string;
  organization: string;
  treasuryOrganization?: string;
}): SeedStep[] {
  const cash = options.cashCode ?? '1000';
  const treasury = options.treasuryOrganization ?? TREASURY;
  return [
    {
      description: 'Beérkezés',
      percent: options.percent,
      debit_code: cash,
      credit_code: '1900',
      currency: 'HUF',
      organization: treasury,
      transaction_type: 'Készpénz',
    },
    {
      description: 'Értékesítés',
      percent: options.percent,
      debit_code: '1900',
      credit_code: options.revenueCode,
      currency: 'HUF',
      organization: options.organization,
      transaction_type: 'Átvezetés',
    },
  ];
}

/** Kor instance: all nine business workflows from docs/plans/0002 section 8. */
export function korTransactionWorkflowSeeds(): SeedWorkflow[] {
  return [
    {
      name: 'Tagi befizetés ingatlan vásárlásra',
      debit_account_code: 1520,
      credit_account_code: 1101,
      steps: [
        {
          description: 'Részjegy előírása',
          percent: 100,
          debit_code: '1101',
          credit_code: '3000',
          currency: 'HUF',
          organization: TREASURY,
          transaction_type: 'Átvezetés',
        },
        {
          description: 'Bejövő tagi utalás',
          percent: 100,
          debit_code: '1100',
          credit_code: '1101',
          currency: 'HUF',
          organization: TREASURY,
          transaction_type: 'Utalás',
        },
        {
          description: 'Stróman (vételár)',
          percent: 96.153846,
          debit_code: '1001',
          credit_code: '1100',
          currency: 'KOR',
          organization: TREASURY,
          transaction_type: 'Átvezetés',
        },
        {
          description: 'Telek vételár',
          percent: 96.153846,
          debit_code: '1520',
          credit_code: '1001',
          currency: 'KOR',
          organization: RESIDENTIAL,
          transaction_type: 'Átvezetés',
        },
        ...lekotesSteps({
          hufPercent: 96.153846,
          korPercent: 0.961538,
          assetCode: '1520',
          assetOrganization: RESIDENTIAL,
        }),
        {
          description: 'Illeték aktiválása',
          percent: 3.846154,
          debit_code: '1520',
          credit_code: '2300',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Átvezetés',
        },
        ...lekotesSteps({
          hufPercent: 3.846154,
          korPercent: 0.038462,
          assetCode: '1520',
          assetOrganization: RESIDENTIAL,
        }).map((step, index) => ({
          ...step,
          description: `Lekötés illeték ${index + 1}`,
        })),
        {
          description: 'Illeték utalása',
          percent: 3.846154,
          debit_code: '2300',
          credit_code: '1100',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Utalás',
        },
      ],
    },
    {
      name: 'Készpénzes belterületi ingatlan vásárlás',
      debit_account_code: 1520,
      credit_account_code: 1000,
      steps: [
        {
          description: 'Telek vételár',
          percent: 100,
          debit_code: '1520',
          credit_code: '1000',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Készpénz',
        },
        ...lekotesSteps({
          hufPercent: 100,
          korPercent: 1,
          assetCode: '1520',
          assetOrganization: RESIDENTIAL,
        }),
        {
          description: 'Illeték aktiválása',
          percent: 4,
          debit_code: '1520',
          credit_code: '2300',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Átvezetés',
        },
        ...lekotesSteps({
          hufPercent: 4,
          korPercent: 0.04,
          assetCode: '1520',
          assetOrganization: RESIDENTIAL,
        }).map((step, index) => ({
          ...step,
          description: `Lekötés illeték ${index + 1}`,
        })),
        {
          description: 'Illeték utalása',
          percent: 4,
          debit_code: '2300',
          credit_code: '1100',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Utalás',
        },
      ],
    },
    {
      name: 'Tojás keletkezése és eladása',
      debit_account_code: 1300,
      credit_account_code: 4500,
      currency: 'EGG',
      steps: [
        {
          description: 'Keletkezés',
          percent: 100,
          debit_code: '1300',
          credit_code: '4500',
          currency: 'EGG',
          organization: HENHOUSE,
          transaction_type: 'Átvezetés',
        },
        {
          description: 'Készletcsökkenés',
          percent: 100,
          debit_code: '5600',
          credit_code: '1300',
          currency: 'EGG',
          organization: HENHOUSE,
          transaction_type: 'Átvezetés',
        },
      ],
    },
    {
      name: 'Tojás eladás forint',
      debit_account_code: 1000,
      credit_account_code: 1900,
      steps: forintRevenueSteps({
        percent: 100,
        revenueCode: '4000',
        organization: HENHOUSE,
      }),
    },
    {
      name: 'Gyümölcs szürete és piaci eladása',
      debit_account_code: 1300,
      credit_account_code: 4500,
      currency: 'FRUIT',
      steps: [
        {
          description: 'Szüret',
          percent: 100,
          debit_code: '1300',
          credit_code: '4500',
          currency: 'FRUIT',
          organization: ORCHARD,
          transaction_type: 'Átvezetés',
        },
        {
          description: 'Készletcsökkenés',
          percent: 62.5,
          debit_code: '5600',
          credit_code: '1300',
          currency: 'FRUIT',
          organization: ORCHARD,
          transaction_type: 'Átvezetés',
        },
      ],
    },
    {
      name: 'Gyümölcs eladás forint',
      debit_account_code: 1000,
      credit_account_code: 1900,
      steps: forintRevenueSteps({
        percent: 100,
        revenueCode: '4000',
        organization: ORCHARD,
      }),
    },
    {
      name: 'Ingatlan szerzése',
      debit_account_code: 1530,
      credit_account_code: 1100,
      steps: [
        {
          description: 'Foglaló',
          percent: 20,
          debit_code: '1400',
          credit_code: '1100',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Utalás',
        },
        {
          description: 'Fennmaradó',
          percent: 80,
          debit_code: '1530',
          credit_code: '1100',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Utalás',
        },
        {
          description: 'Beszámítás',
          percent: 20,
          debit_code: '1530',
          credit_code: '1400',
          currency: 'HUF',
          organization: RESIDENTIAL,
          transaction_type: 'Átvezetés',
        },
        ...lekotesSteps({
          hufPercent: 100,
          korPercent: 1,
          assetCode: '1530',
          assetOrganization: RESIDENTIAL,
        }),
      ],
    },
    {
      name: 'Felújítás',
      debit_account_code: 1500,
      credit_account_code: 2000,
      steps: [
        {
          description: 'Aktiválás',
          percent: 100,
          debit_code: '1500',
          credit_code: '2000',
          currency: 'HUF',
          organization: LIVESTOCK,
          transaction_type: 'Átvezetés',
        },
        {
          description: 'Utalás',
          percent: 100,
          debit_code: '2000',
          credit_code: '1100',
          currency: 'HUF',
          organization: LIVESTOCK,
          transaction_type: 'Utalás',
        },
        ...lekotesSteps({
          hufPercent: 100,
          korPercent: 1,
          assetCode: '1500',
          assetOrganization: LIVESTOCK,
        }),
      ],
    },
    {
      name: 'Területalapú agrár támogatás',
      debit_account_code: 1200,
      credit_account_code: 4200,
      steps: [
        {
          description: 'Megítélés',
          percent: 100,
          debit_code: '1200',
          credit_code: '4200',
          currency: 'HUF',
          organization: CROPLAND,
          transaction_type: 'Átvezetés',
        },
        {
          description: 'Kincstári jóváírás',
          percent: 100,
          debit_code: '1100',
          credit_code: '1900',
          currency: 'HUF',
          organization: TREASURY,
          transaction_type: 'Utalás',
        },
        {
          description: 'Követelés zárása',
          percent: 100,
          debit_code: '1900',
          credit_code: '1200',
          currency: 'HUF',
          organization: CROPLAND,
          transaction_type: 'Átvezetés',
        },
      ],
    },
    {
      name: 'Adminisztráció',
      debit_account_code: 5440,
      credit_account_code: 2000,
      steps: [
        {
          description: 'Számla',
          percent: 100,
          debit_code: '5440',
          credit_code: '2000',
          currency: 'HUF',
          organization: TREASURY,
          transaction_type: 'Átvezetés',
        },
        {
          description: 'Utalás',
          percent: 100,
          debit_code: '2000',
          credit_code: '1100',
          currency: 'HUF',
          organization: TREASURY,
          transaction_type: 'Utalás',
        },
      ],
    },
    {
      name: 'Bányászás (bank)',
      debit_account_code: 1001,
      credit_account_code: 1100,
      transaction_type: 'Bányászás',
      steps: [
        {
          description: 'Bányászás',
          percent: 100,
          debit_code: '1001',
          credit_code: '1100',
          currency: 'HUF',
          organization: TREASURY,
          transaction_type: 'Bányászás',
        },
      ],
    },
    {
      name: 'Bányászás (készpénz)',
      debit_account_code: 1001,
      credit_account_code: 1000,
      transaction_type: 'Bányászás',
      steps: [
        {
          description: 'Bányászás',
          percent: 100,
          debit_code: '1001',
          credit_code: '1000',
          currency: 'HUF',
          organization: TREASURY,
          transaction_type: 'Bányászás',
        },
      ],
    },
  ];
}
