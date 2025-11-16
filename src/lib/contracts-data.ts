import { getDataClientServerSide } from "./amplify-server";

type GraphQLError = {
  message: string;
};

type GraphQLResult<T> = {
  data?: T;
  errors?: GraphQLError[];
};

export type ContractExchangeRecord = {
  id: string;
  title: string;
  partyAId: string;
  partyBId: string;
  createdById: string;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ContractFileRecord = {
  id: string;
  exchangeId: string;
  ownerId: string;
  uploaderId: string;
  fileName: string;
  fileSize: number | null;
  fileHash?: string | null;
  s3Key: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const CONTRACT_EXCHANGE_FIELDS = `
  id
  title
  partyAId
  partyBId
  createdById
  status
  createdAt
  updatedAt
`;

const CONTRACT_FILE_FIELDS = `
  id
  exchangeId
  ownerId
  uploaderId
  fileName
  fileSize
  fileHash
  s3Key
  createdAt
  updatedAt
`;

const LIST_CONTRACT_EXCHANGES = /* GraphQL */ `
  query ListContractExchanges($filter: ModelContractExchangeFilterInput) {
    listContractExchanges(filter: $filter, limit: 500) {
      items {
        ${CONTRACT_EXCHANGE_FIELDS}
      }
      nextToken
    }
  }
`;

const GET_CONTRACT_EXCHANGE = /* GraphQL */ `
  query GetContractExchange($id: ID!) {
    getContractExchange(id: $id) {
      ${CONTRACT_EXCHANGE_FIELDS}
    }
  }
`;

const LIST_CONTRACT_FILES = /* GraphQL */ `
  query ListContractFiles($filter: ModelContractFileFilterInput) {
    listContractFiles(filter: $filter, limit: 500) {
      items {
        ${CONTRACT_FILE_FIELDS}
      }
      nextToken
    }
  }
`;

const CREATE_CONTRACT_EXCHANGE = /* GraphQL */ `
  mutation CreateContractExchange($input: CreateContractExchangeInput!) {
    createContractExchange(input: $input) {
      ${CONTRACT_EXCHANGE_FIELDS}
    }
  }
`;

const UPDATE_CONTRACT_EXCHANGE_STATUS = /* GraphQL */ `
  mutation UpdateContractExchangeStatus($input: UpdateContractExchangeInput!) {
    updateContractExchange(input: $input) {
      ${CONTRACT_EXCHANGE_FIELDS}
    }
  }
`;

export async function listContractExchangesForUser(userId: string): Promise<ContractExchangeRecord[]> {
  const data = await executeGraphQL<{
    listContractExchanges?: {
      items?: Array<ContractExchangeRecord | null>;
    };
  }>(LIST_CONTRACT_EXCHANGES, {
    filter: {
      or: [{ partyAId: { eq: userId } }, { partyBId: { eq: userId } }],
    },
  });

  return (data.listContractExchanges?.items ?? []).filter(
    (item: ContractExchangeRecord | null | undefined): item is ContractExchangeRecord =>
      Boolean(item)
  );
}

export async function getContractExchangeById(id: string): Promise<ContractExchangeRecord | null> {
  const data = await executeGraphQL<{
    getContractExchange?: ContractExchangeRecord | null;
  }>(GET_CONTRACT_EXCHANGE, { id });

  return data.getContractExchange ?? null;
}

export async function listContractFilesForExchange(
  exchangeId: string
): Promise<ContractFileRecord[]> {
  const data = await executeGraphQL<{
    listContractFiles?: {
      items?: Array<ContractFileRecord | null>;
    };
  }>(LIST_CONTRACT_FILES, {
    filter: {
      exchangeId: { eq: exchangeId },
    },
  });

  return (data.listContractFiles?.items ?? []).filter(
    (item: ContractFileRecord | null | undefined): item is ContractFileRecord =>
      Boolean(item)
  );
}

export async function createContractExchangeRecord(input: {
  title: string;
  partyAId: string;
  partyBId: string;
  createdById: string;
  status?: string;
}): Promise<ContractExchangeRecord> {
  const data = await executeGraphQL<{
    createContractExchange?: ContractExchangeRecord | null;
  }>(CREATE_CONTRACT_EXCHANGE, {
    input,
  });

  if (!data.createContractExchange) {
    throw new Error("Exchange creation returned an empty response.");
  }

  return data.createContractExchange;
}

export async function updateContractExchangeStatus(input: {
  id: string;
  status: "PENDING" | "COMPLETED" | "ACTION_REQUIRED";
}): Promise<ContractExchangeRecord> {
  const data = await executeGraphQL<{
    updateContractExchange?: ContractExchangeRecord | null;
  }>(UPDATE_CONTRACT_EXCHANGE_STATUS, {
    input,
  });

  if (!data.updateContractExchange) {
    throw new Error("Exchange status update returned an empty response.");
  }

  return data.updateContractExchange;
}

async function executeGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
) {
  const dataClient = getDataClientServerSide();
  const result = (await (dataClient as any).graphql({
    query,
    variables,
  })) as GraphQLResult<T>;

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }

  if (!result.data) {
    throw new Error("GraphQL response missing data.");
  }

  return result.data;
}
