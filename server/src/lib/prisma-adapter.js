import { createAdapterFactory } from "@better-auth/core/db/adapter";
import { BetterAuthError } from "@better-auth/core/error";

export function prismaAdapter(prisma, config) {
  let lazyOptions = null;

  const createCustomAdapter =
    (activePrisma) =>
    ({ getFieldName, getModelName, getFieldAttributes, getDefaultModelName, schema }) => {
      const db = activePrisma;

      const convertSelect = (select, model, join) => {
        if (!select && !join) return undefined;

        const result = {};

        if (select) {
          for (const field of select) {
            result[getFieldName({ model, field })] = true;
          }
        }

        if (join) {
          if (!select) {
            const fields = schema[getDefaultModelName(model)]?.fields || {};
            fields.id = { type: "string" };
            for (const field of Object.keys(fields)) {
              result[getFieldName({ model, field })] = true;
            }
          }

          for (const [joinModel, joinAttr] of Object.entries(join)) {
            const key = getJoinKeyName(model, getModelName(joinModel), schema);
            result[key] =
              joinAttr.relation === "one-to-one" ? true : { take: joinAttr.limit };
          }
        }

        return result;
      };

      const getJoinKeyName = (baseModel, joinedModel, currentSchema) => {
        try {
          const defaultBaseModelName = getDefaultModelName(baseModel);
          const defaultJoinedModelName = getDefaultModelName(joinedModel);
          const key = getModelName(joinedModel).toLowerCase();

          let foreignKeys = Object.entries(
            currentSchema[defaultJoinedModelName]?.fields || {},
          ).filter(
            ([, fieldAttributes]) =>
              fieldAttributes.references &&
              getDefaultModelName(fieldAttributes.references.model) ===
                defaultBaseModelName,
          );

          if (foreignKeys.length > 0) {
            const [, foreignKeyAttributes] = foreignKeys[0];
            return foreignKeyAttributes?.unique === true || config.usePlural === true
              ? key
              : `${key}s`;
          }

          foreignKeys = Object.entries(
            currentSchema[defaultBaseModelName]?.fields || {},
          ).filter(
            ([, fieldAttributes]) =>
              fieldAttributes.references &&
              getDefaultModelName(fieldAttributes.references.model) ===
                defaultJoinedModelName,
          );

          if (foreignKeys.length > 0) {
            return key;
          }
        } catch {
          // Fall through to the default pluralized key.
        }

        return `${getModelName(joinedModel).toLowerCase()}s`;
      };

      function operatorToPrismaOperator(operator) {
        switch (operator) {
          case "starts_with":
            return "startsWith";
          case "ends_with":
            return "endsWith";
          case "ne":
            return "not";
          case "not_in":
            return "notIn";
          default:
            return operator;
        }
      }

      const convertWhereClause = ({ action, model, where }) => {
        if (!where || !where.length) return {};

        const buildSingleCondition = (condition) => {
          const fieldName = getFieldName({
            model,
            field: condition.field,
          });

          if (condition.operator === "ne" && condition.value === null) {
            return getFieldAttributes({
              model,
              field: condition.field,
            })?.required !== true
              ? { [fieldName]: { not: null } }
              : {};
          }

          if (
            (condition.operator === "in" || condition.operator === "not_in") &&
            Array.isArray(condition.value)
          ) {
            const filtered = condition.value.filter((value) => value != null);

            if (filtered.length === 0) {
              return condition.operator === "in"
                ? {
                    AND: [
                      { [fieldName]: { equals: "__never__" } },
                      { [fieldName]: { not: "__never__" } },
                    ],
                  }
                : {};
            }

            return {
              [fieldName]: {
                [operatorToPrismaOperator(condition.operator)]: filtered,
              },
            };
          }

          if (condition.operator === "eq" || !condition.operator) {
            return { [fieldName]: condition.value };
          }

          return {
            [fieldName]: {
              [operatorToPrismaOperator(condition.operator)]: condition.value,
            },
          };
        };

        if (action === "update") {
          const andConditions = where.filter(
            (condition) => condition.connector === "AND" || !condition.connector,
          );
          const orConditions = where.filter(
            (condition) => condition.connector === "OR",
          );
          const result = {};

          for (const clause of andConditions
            .filter((condition) => condition.operator === "eq" || !condition.operator)
            .map(buildSingleCondition)) {
            Object.assign(result, clause);
          }

          const andClauses = andConditions
            .filter((condition) => condition.operator !== "eq" && condition.operator)
            .map(buildSingleCondition);
          const orClauses = orConditions.map(buildSingleCondition);

          if (andClauses.length > 0) result.AND = andClauses;
          if (orClauses.length > 0) result.OR = orClauses;

          return result;
        }

        if (action === "delete") {
          const idCondition = where.find((condition) => condition.field === "id");

          if (idCondition) {
            const idFieldName = getFieldName({ model, field: "id" });
            const idClause = buildSingleCondition(idCondition);
            const remainingWhere = where.filter((condition) => condition.field !== "id");

            if (remainingWhere.length === 0) {
              return idClause;
            }

            const result = {};
            if (idFieldName in idClause) result[idFieldName] = idClause[idFieldName];
            else Object.assign(result, idClause);

            const andClauses = remainingWhere
              .filter((condition) => condition.connector === "AND" || !condition.connector)
              .map(buildSingleCondition);
            const orClauses = remainingWhere
              .filter((condition) => condition.connector === "OR")
              .map(buildSingleCondition);

            if (andClauses.length > 0) result.AND = andClauses;
            if (orClauses.length > 0) result.OR = orClauses;

            return result;
          }
        }

        if (where.length === 1) {
          return buildSingleCondition(where[0]);
        }

        const andClauses = where
          .filter((condition) => condition.connector === "AND" || !condition.connector)
          .map(buildSingleCondition);
        const orClauses = where
          .filter((condition) => condition.connector === "OR")
          .map(buildSingleCondition);

        return {
          ...(andClauses.length ? { AND: andClauses } : {}),
          ...(orClauses.length ? { OR: orClauses } : {}),
        };
      };

      return {
        async create({ model, data: values, select }) {
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            );
          }

          return db[model].create({
            data: values,
            select: convertSelect(select, model),
          });
        },
        async findOne({ model, where, select, join }) {
          const whereClause = convertWhereClause({ model, where, action: "findOne" });

          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            );
          }

          const map = new Map();
          for (const joinModel of Object.keys(join ?? {})) {
            map.set(getJoinKeyName(model, joinModel, schema), getModelName(joinModel));
          }

          const result = await db[model].findFirst({
            where: whereClause,
            select: convertSelect(select, model, join),
          });

          if (join && result) {
            for (const [includeKey, originalKey] of map.entries()) {
              if (includeKey !== originalKey && includeKey in result) {
                result[originalKey] = result[includeKey];
                delete result[includeKey];
              }
            }
          }

          return result;
        },
        async findMany({ model, where, limit, select, offset, sortBy, join }) {
          const whereClause = convertWhereClause({ model, where, action: "findMany" });

          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            );
          }

          const map = new Map();
          if (join) {
            for (const [joinModel] of Object.entries(join)) {
              map.set(getJoinKeyName(model, joinModel, schema), getModelName(joinModel));
            }
          }

          const result = await db[model].findMany({
            where: whereClause,
            take: limit || 100,
            skip: offset || 0,
            ...(sortBy?.field
              ? {
                  orderBy: {
                    [getFieldName({ model, field: sortBy.field })]:
                      sortBy.direction === "desc" ? "desc" : "asc",
                  },
                }
              : {}),
            select: convertSelect(select, model, join),
          });

          if (join && Array.isArray(result)) {
            for (const item of result) {
              for (const [includeKey, originalKey] of map.entries()) {
                if (includeKey !== originalKey && includeKey in item) {
                  item[originalKey] = item[includeKey];
                  delete item[includeKey];
                }
              }
            }
          }

          return result;
        },
        async count({ model, where }) {
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            );
          }

          return db[model].count({
            where: convertWhereClause({ model, where, action: "count" }),
          });
        },
        async update({ model, where, update }) {
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            );
          }

          return db[model].update({
            where: convertWhereClause({ model, where, action: "update" }),
            data: update,
          });
        },
        async updateMany({ model, where, update }) {
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            );
          }

          const result = await db[model].updateMany({
            where: convertWhereClause({ model, where, action: "updateMany" }),
            data: update,
          });

          return result ? result.count : 0;
        },
        async delete({ model, where }) {
          if (!db[model]) {
            throw new BetterAuthError(
              `Model ${model} does not exist in the database. If you haven't generated the Prisma client, you need to run 'npx prisma generate'`,
            );
          }

          if (!where?.some((condition) => condition.field === "id")) {
            await db[model].deleteMany({
              where: convertWhereClause({ model, where, action: "deleteMany" }),
            });
            return;
          }

          try {
            await db[model].delete({
              where: convertWhereClause({ model, where, action: "delete" }),
            });
          } catch (error) {
            if (error?.meta?.cause === "Record to delete does not exist.") return;
            if (error?.code === "P2025") return;
            console.log(error);
          }
        },
        async deleteMany({ model, where }) {
          const result = await db[model].deleteMany({
            where: convertWhereClause({ model, where, action: "deleteMany" }),
          });

          return result ? result.count : 0;
        },
        options: config,
      };
    };

  let adapterOptions = null;

  adapterOptions = {
    config: {
      ...config,
      adapterId: "prisma",
      adapterName: "Prisma Adapter",
      usePlural: config.usePlural ?? false,
      debugLogs: config.debugLogs ?? false,
      supportsUUIDs:
        config.supportsUUIDs ?? (config.provider === "postgresql" ? true : false),
      supportsArrays:
        config.supportsArrays ??
        (config.provider === "postgresql" || config.provider === "mongodb"),
      transaction:
        config.transaction ?? false
          ? (callback) =>
              prisma.$transaction((tx) =>
                callback(
                  createAdapterFactory({
                    config: adapterOptions.config,
                    adapter: createCustomAdapter(tx),
                  })(lazyOptions),
                ),
              )
          : false,
    },
    adapter: createCustomAdapter(prisma),
  };

  const adapter = createAdapterFactory(adapterOptions);

  return (options) => {
    lazyOptions = options;
    return adapter(options);
  };
}
