import express from 'express';
import { odataQuery, executeQuery, processBaseBuilder, processIncludes, processRootSelect, processFilter } from '../../../';
import { getConnection, getRepository } from 'typeorm';

import { Author } from './entities/author';
import { Post } from './entities/post';
import { PostCategory } from './entities/postCategory';
import { PostDetails } from './entities/postDetails';

import { DataFilling1577087002356 } from './migrations/1577087002356-dataFilling';
import { createConnection } from './db/createConnection';
import config from './config';
import * as ormconfig from './ormconfig.json'
import { User } from './entities/user';
import { PostComment } from './entities/postComment';

export default (async () => {
  try {
    const dbConfig = config.db;
    await createConnection([
      Author,
      Post,
      PostCategory,
      PostDetails,
      PostComment,
      User
    ], [DataFilling1577087002356], { ...dbConfig, ...ormconfig });

    const app = express();

    // Posts
    const postsRepository = getRepository(Post);
    app.get('/api/posts/([\$])metadata', (res, req) => {
      const metadata = getConnection().getMetadata(Post).ownColumns.map(column => column.propertyName);
      return req.status(200).json(metadata)
    });
    app.get('/api/posts', odataQuery(postsRepository));

    /**
     * Example showing a way to use the same Odata query object to collect aggregates. 
     * We aren't using Odata aggregate extension specs, instead we're directly using "internal" 
     * odata-v4-typeorm functions to avoid also doing things like pagination and whatbot
     */
    app.get('/api/posts/aggregate', async (res, req) => {
      const postRepo = getConnection().getRepository(Post)
      const queryBuilder = postRepo.createQueryBuilder()
      let query = req.req.query;

      // get the data as we normally would
      let data = await executeQuery(queryBuilder.clone(), query, {})

      // Start a new querybuilder for the group by
      let [newQueryBuilder, odataQuery] = await processBaseBuilder(queryBuilder.clone(), query, {});

      // for the group by, we only need the joins and filter. Select, Pagination, etc should not be factored in. 
      newQueryBuilder = await processIncludes(newQueryBuilder, odataQuery);
      newQueryBuilder = await processFilter(newQueryBuilder, odataQuery);
      let groupData =
        await newQueryBuilder
          .groupBy('Post.author_id')
          .select('Post.author_id')
          .addSelect("COUNT(*) AS count")
          .getRawMany();

      req.status(200).json({ groupData, data })
    });

    // Authors
    const authorsRepository = getRepository(Author);
    app.get('/api/authors/([\$])metadata', (res, req) => {
      const metadata = getConnection().getMetadata(Author).ownColumns.map(column => column.propertyName);
      return req.status(200).json(metadata)
    });
    app.get('/api/authors', odataQuery(authorsRepository));

    const port = config.http.port;
    app.listen(port, () => console.log(`Example app listening on port ${port}!`));
  } catch (e) {
    console.error(e, 'Start service error');
  }
})();
