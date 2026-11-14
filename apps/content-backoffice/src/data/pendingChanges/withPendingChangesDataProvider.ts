import type { DataProvider } from 'react-admin';

import { dataProviderPayload, executeWithOutbox } from './executeWithOutbox';
import type { PendingDataProviderMethod } from './types';

const WRITE_METHODS: PendingDataProviderMethod[] = [
  'create',
  'update',
  'delete',
  'updateMany',
  'deleteMany',
];

export function withPendingChangesOutbox(
  inner: DataProvider,
  options?: { skipOutbox?: boolean },
): DataProvider {
  if (options?.skipOutbox) {
    return inner;
  }
  const wrap =
    <M extends PendingDataProviderMethod>(method: M) =>
    async (
      resource: string,
      params: Parameters<NonNullable<DataProvider[M]>>[1],
    ) => {
      return executeWithOutbox({
        resource,
        operation: method,
        payload: dataProviderPayload(
          method,
          resource,
          params as unknown as Record<string, unknown>,
        ),
        run: () =>
          (
            inner[method] as (
              r: string,
              p: typeof params,
            ) => ReturnType<NonNullable<DataProvider[M]>>
          )(resource, params),
      });
    };

  return {
    ...inner,
    create: wrap('create'),
    update: wrap('update'),
    delete: wrap('delete'),
    updateMany: inner.updateMany ? wrap('updateMany') : undefined,
    deleteMany: inner.deleteMany ? wrap('deleteMany') : undefined,
  } as DataProvider;
}

export function isPendingChangesWriteMethod(method: string): boolean {
  return WRITE_METHODS.includes(method as PendingDataProviderMethod);
}
