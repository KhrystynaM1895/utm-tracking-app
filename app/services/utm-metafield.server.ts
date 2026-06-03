/**
 * Ensures the `custom.utm_source` order metafield definition exists and is
 * pinned. Idempotent — safe to call repeatedly, but intended to run once per
 * shop from the `afterAuth` hook rather than on every admin page load.
 */

type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const METAFIELD_DEFINITION_CREATE = `#graphql
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id }
      userErrors { code field message }
    }
  }
`;

const METAFIELD_DEFINITIONS_QUERY = `#graphql
  query FindUtmSourceDefinition {
    metafieldDefinitions(first: 20, ownerType: ORDER, namespace: "custom") {
      nodes { id key pinnedPosition }
    }
  }
`;

const METAFIELD_DEFINITION_PIN = `#graphql
  mutation MetafieldDefinitionPin($definitionId: ID!) {
    metafieldDefinitionPin(definitionId: $definitionId) {
      pinnedDefinition { id pinnedPosition }
      userErrors { code field message }
    }
  }
`;

export async function ensureUtmMetafieldDefinition(
  admin: AdminGraphqlClient,
  shop: string,
): Promise<void> {
  try {
    const createRes = await admin.graphql(METAFIELD_DEFINITION_CREATE, {
      variables: {
        definition: {
          name: "UTM Source",
          namespace: "custom",
          key: "utm_source",
          type: "single_line_text_field",
          ownerType: "ORDER",
        },
      },
    });

    const { data: createData } = await createRes.json();
    const errors: Array<{ code: string; message: string }> =
      createData?.metafieldDefinitionCreate?.userErrors ?? [];

    let definitionId: string | null =
      createData?.metafieldDefinitionCreate?.createdDefinition?.id ?? null;

    if (errors.some((e) => e.code === "TAKEN")) {
      const queryRes = await admin.graphql(METAFIELD_DEFINITIONS_QUERY);
      const { data: queryData } = await queryRes.json();
      const nodes: Array<{
        id: string;
        key: string;
        pinnedPosition: number | null;
      }> = queryData?.metafieldDefinitions?.nodes ?? [];
      const def = nodes.find((n) => n.key === "utm_source");

      if (def) {
        if (def.pinnedPosition !== null) return;
        definitionId = def.id;
      }
    } else {
      const realErrors = errors.filter((e) => e.code !== "TAKEN");
      if (realErrors.length > 0) {
        console.error(
          `[utm] ${shop} metafieldDefinitionCreate errors:`,
          realErrors,
        );
        return;
      }
    }

    if (!definitionId) return;

    const pinRes = await admin.graphql(METAFIELD_DEFINITION_PIN, {
      variables: { definitionId },
    });
    const { data: pinData } = await pinRes.json();
    const pinErrors = pinData?.metafieldDefinitionPin?.userErrors ?? [];
    if (pinErrors.length > 0) {
      console.error(`[utm] ${shop} metafieldDefinitionPin errors:`, pinErrors);
    }
  } catch (err) {
    console.error(`[utm] ${shop} ensureUtmMetafieldDefinition failed:`, err);
  }
}
