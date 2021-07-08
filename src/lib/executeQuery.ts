import { createQuery } from './createQuery';

const mapToObject = (aMap) => {
  const obj = {};
  if (aMap) {
    aMap.forEach((v, k) => {
      obj[k] = v;
    });
  }
  return obj;
};

const queryToOdataString = (query): string => {
  let result = '';
  for (let key in query) {
    if (key.startsWith('$')) {
      if (result !== '') {
        result += '&';
      }
      result += `${key}=${query[key]}`;
    }
  }
  return result;
};

const processIncludes = async (queryBuilder: any, odataQuery: any, alias: string = null, parent_metadata: any = null): Promise<any> => {
  if (!alias) {
    alias = queryBuilder.expressionMap.mainAlias.name;
  }
  if (!parent_metadata) {
    parent_metadata = queryBuilder.connection.getMetadata(alias);
  }
  if (odataQuery.includes && odataQuery.includes.length > 0) {
    for (const item of odataQuery.includes) {
      const relation_metadata = queryBuilder.connection.getMetadata(parent_metadata.relations.find(x => x.propertyPath === item.navigationProperty).type)
      const join = item.select === '*' ? 'leftJoinAndSelect' : 'leftJoin';
      if (join === 'leftJoin') {
        // add selections of data
        // todo: remove columns that are isSelect: false
        queryBuilder.addSelect(item.select.split(',').map(x => x.trim()).filter(x => x !== ''));
      }

      queryBuilder = queryBuilder[join](
        (alias ? alias + '.' : '') + item.navigationProperty,
        item.alias,
        item.where.replace(/typeorm_query/g, item.navigationProperty),
        mapToObject(item.parameters)
      );

      if (item.orderby && item.orderby != '1') {
        const orders = item.orderby.split(',').map(i => i.trim().replace(/typeorm_query/g, item.navigationProperty));
        orders.forEach((itemOrd) => {
          queryBuilder = queryBuilder.addOrderBy(...(itemOrd.split(' ')));
        });
      }

      if (item.includes && item.includes.length > 0) {
        await processIncludes(queryBuilder, { includes: item.includes }, item.alias, relation_metadata);
      }
    };
  }

  return queryBuilder;
};

const processBaseBuilder = async (queryBuilder, query, options) => {
  const alias = queryBuilder.expressionMap.mainAlias.name;
  //const filter = createFilter(query.$filter, {alias: alias});
  let odataQuery: any = {};
  if (query) {
    const odataString = queryToOdataString(query);
    if (odataString) {
      odataQuery = createQuery(odataString, { alias: alias });
    }
  }

  return [queryBuilder, odataQuery]
}

const processFilter = async (queryBuilder, odataQuery, options = null) => {
  return queryBuilder
    .andWhere(odataQuery.where)
    .setParameters(mapToObject(odataQuery.parameters));
}

const processOrderBy = async (queryBuilder, odataQuery, options = null) => {
  if (odataQuery.orderby && odataQuery.orderby !== '1') {
    const orders = odataQuery.orderby.split(',').map(i => i.trim());
    orders.forEach((item) => {
      queryBuilder = queryBuilder.addOrderBy(...(item.split(' ')));
    });
  }
  return queryBuilder;
}

const processPaging = async (queryBuilder, odataQuery, options = null) => {
  queryBuilder = queryBuilder.skip(odataQuery.skip || 0);
  if (odataQuery.limit) {
    queryBuilder = queryBuilder.take(odataQuery.limit);
  }
  return queryBuilder
}

const processRootSelect = async (queryBuilder, odataQuery, options = null) => {
  const alias = queryBuilder.expressionMap.mainAlias.name;
  const metadata = queryBuilder.connection.getMetadata(alias);
  let root_select = []

  // unlike the relations which are done via leftJoin[AndSelect](), we must explicitly add root
  // entity fields to the selection if it hasn't been narrowed down by the user.
  if (Object.keys(odataQuery).length === 0 || odataQuery.select === '*') {
    root_select = metadata.nonVirtualColumns.map(x => `${alias}.${x.propertyPath}`);
  } else {
    root_select = odataQuery.select.split(',').map(x => x.trim())
  }

  return queryBuilder.select(root_select);
}

const executeQueryByQueryBuilder = async (inputQueryBuilder, query, options: any) => {
  let [queryBuilder, odataQuery] = await processBaseBuilder(inputQueryBuilder, query, options);

  queryBuilder = await processRootSelect(queryBuilder, odataQuery);
  queryBuilder = await processIncludes(queryBuilder, odataQuery);
  queryBuilder = await processFilter(queryBuilder, odataQuery)
  queryBuilder = await processOrderBy(queryBuilder, odataQuery)
  queryBuilder = await processPaging(queryBuilder, odataQuery)

  if (query.$count && query.$count !== 'false') {
    const resultData = await queryBuilder.getManyAndCount();
    return {
      items: resultData[0],
      count: resultData[1]
    }
  }

  return queryBuilder.getMany();
};

const executeQuery = async (repositoryOrQueryBuilder: any, query, options: any) => {
  options = options || {};
  const alias = options.alias || '';
  let queryBuilder = null;

  // check that input object is query builder
  if (typeof repositoryOrQueryBuilder.expressionMap !== 'undefined') {
    queryBuilder = repositoryOrQueryBuilder;
  } else {
    queryBuilder = repositoryOrQueryBuilder.createQueryBuilder(alias);
  }
  const result = await executeQueryByQueryBuilder(queryBuilder, query, { alias });
  return result;
};

export { executeQuery, processBaseBuilder, processFilter, processPaging, processOrderBy, processRootSelect, processIncludes };