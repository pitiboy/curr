export class ReconciliationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReconciliationError';
    this.status = status;
  }
}
