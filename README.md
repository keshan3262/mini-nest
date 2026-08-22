# mini-nest

## The current backend

One-stage build container has a size of 314 MB because of installed development dependencies and source code, while the multi-stage build container has a size of 254 MB.

To build the backend container, run `docker build -f Dockerfile -t hw-08 .`. Then run it with command `docker run -d --name hw-08 -p 3000:3000 hw-08`.

You can start both backend and Postgres DB in 'production' mode with command `docker compose -f docker-compose.yml up -d --wait` or in development mode with hot reload using `docker compose up -d --wait`.
To check that Postgres data is persisted, do the following steps when all containers are up:
1. Run `docker compose exec postgres psql -U postgres -d postgres -c "CREATE TABLE IF NOT EXISTS test(id int); INSERT INTO test VALUES (1);"`. You should see output like below:
  ```
  CREATE TABLE
  INSERT 0 1
  ```
2. Remove all containers with the command `docker compose down`.
3. Run all containers again using `docker compose up -d --wait`.
4. Count all rows from the `test` table with command `docker compose exec postgres psql -U postgres -d postgres -c "SELECT count(*) from test;"`. You should see output like this, make sure that there is at least one row (you may have more if you have inserted some rows before):
  ```
   count
  -------
       1
  (1 row)
  ```

## Mini Nest.js

This project contains a prototype of Nest.js framework. You can run tests using the command `docker compose run --rm api npm test`. This prototype, like true Nest.js, requires the following TypeScript configuration options:
```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```
`experimentalDecorators` enables TypeScript decorators usage, and `emitDecoratorMetadata` enables emitting type metadata for decorated declarations. Type metadata for constructors is fetched with `Reflect.getMetadata('design:paramtypes', constructor)` call and is then used to resolve constructor arguments automatically. However, this call resolves arguments of interface types to `Object` constructor, so you have to decorate such arguments with `@Inject(token)`.
