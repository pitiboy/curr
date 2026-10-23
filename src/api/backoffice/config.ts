import { readPublishPolicy } from '../../publish-guard';

import { selectWorkflows, type BackofficeWorkflowConfig } from './workflows';

export type BackofficeConfigResponse = BackofficeWorkflowConfig & {
  publisherMustDiffer: boolean;
};

export function buildBackofficeConfig(
  env: Record<string, string | undefined> = process.env,
): BackofficeConfigResponse {
  return {
    ...selectWorkflows(env.BACKOFFICE_WORKFLOWS),
    publisherMustDiffer: readPublishPolicy(env).publisherMustDiffer,
  };
}
