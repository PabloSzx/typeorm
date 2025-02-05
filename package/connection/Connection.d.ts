import { EntitySchema } from "../";
import { QueryResultCache } from "../cache/QueryResultCache";
import { ObjectType } from "../common/ObjectType";
import { Driver } from "../driver/Driver";
import { IsolationLevel } from "../driver/types/IsolationLevel";
import { EntityManager } from "../entity-manager/EntityManager";
import { MongoEntityManager } from "../entity-manager/MongoEntityManager";
import { SqljsEntityManager } from "../entity-manager/SqljsEntityManager";
import { Logger } from "../logger/Logger";
import { EntityMetadata } from "../metadata/EntityMetadata";
import { Migration } from "../migration/Migration";
import { MigrationInterface } from "../migration/MigrationInterface";
import { NamingStrategyInterface } from "../naming-strategy/NamingStrategyInterface";
import { RelationIdLoader } from "../query-builder/RelationIdLoader";
import { RelationLoader } from "../query-builder/RelationLoader";
import { SelectQueryBuilder } from "../query-builder/SelectQueryBuilder";
import { QueryRunner } from "../query-runner/QueryRunner";
import { MongoRepository } from "../repository/MongoRepository";
import { Repository } from "../repository/Repository";
import { TreeRepository } from "../repository/TreeRepository";
import { EntitySubscriberInterface } from "../subscriber/EntitySubscriberInterface";
import { ConnectionOptions } from "./ConnectionOptions";
/**
 * Connection is a single database ORM connection to a specific database.
 * Its not required to be a database connection, depend on database type it can create connection pool.
 * You can have multiple connections to multiple databases in your application.
 */
export declare class Connection {
    /**
     * Connection name.
     */
    readonly name: string;
    /**
     * Connection options.
     */
    readonly options: ConnectionOptions;
    /**
     * Indicates if connection is initialized or not.
     */
    readonly isConnected: boolean;
    /**
     * Database driver used by this connection.
     */
    readonly driver: Driver;
    /**
     * EntityManager of this connection.
     */
    readonly manager: EntityManager;
    /**
     * Naming strategy used in the connection.
     */
    readonly namingStrategy: NamingStrategyInterface;
    /**
     * Logger used to log orm events.
     */
    readonly logger: Logger;
    /**
     * Migration instances that are registered for this connection.
     */
    readonly migrations: MigrationInterface[];
    /**
     * Entity subscriber instances that are registered for this connection.
     */
    readonly subscribers: EntitySubscriberInterface<any>[];
    /**
     * All entity metadatas that are registered for this connection.
     */
    readonly entityMetadatas: EntityMetadata[];
    /**
     * Used to work with query result cache.
     */
    readonly queryResultCache?: QueryResultCache;
    /**
     * Used to load relations and work with lazy relations.
     */
    readonly relationLoader: RelationLoader;
    /**
     * Used to load relation ids of specific entity relations.
     */
    readonly relationIdLoader: RelationIdLoader;
    constructor(options: ConnectionOptions);
    /**
     * Gets the mongodb entity manager that allows to perform mongodb-specific repository operations
     * with any entity in this connection.
     *
     * Available only in mongodb connections.
     */
    readonly mongoManager: MongoEntityManager;
    /**
     * Gets a sql.js specific Entity Manager that allows to perform special load and save operations
     *
     * Available only in connection with the sqljs driver.
     */
    readonly sqljsManager: SqljsEntityManager;
    /**
     * Performs connection to the database.
     * This method should be called once on application bootstrap.
     * This method not necessarily creates database connection (depend on database type),
     * but it also can setup a connection pool with database to use.
     */
    connect(): Promise<this>;
    /**
     * Closes connection with the database.
     * Once connection is closed, you cannot use repositories or perform any operations except opening connection again.
     */
    close(): Promise<void>;
    /**
     * Creates database schema for all entities registered in this connection.
     * Can be used only after connection to the database is established.
     *
     * @param dropBeforeSync If set to true then it drops the database with all its tables and data
     */
    synchronize(dropBeforeSync?: boolean): Promise<void>;
    /**
     * Drops the database and all its data.
     * Be careful with this method on production since this method will erase all your database tables and their data.
     * Can be used only after connection to the database is established.
     */
    dropDatabase(): Promise<void>;
    /**
     * Runs all pending migrations.
     * Can be used only after connection to the database is established.
     */
    runMigrations(options?: {
        transaction?: boolean;
    }): Promise<Migration[]>;
    /**
     * Reverts last executed migration.
     * Can be used only after connection to the database is established.
     */
    undoLastMigration(options?: {
        transaction?: boolean;
    }): Promise<void>;
    /**
     * Lists all migrations and whether they have been run.
     * Returns true if there are pending migrations
     */
    showMigrations(): Promise<boolean>;
    /**
     * Checks if entity metadata exist for the given entity class, target name or table name.
     */
    hasMetadata(target: Function | EntitySchema<any> | string): boolean;
    /**
     * Gets entity metadata for the given entity class or schema name.
     */
    getMetadata(target: Function | EntitySchema<any> | string): EntityMetadata;
    /**
     * Gets repository for the given entity.
     */
    getRepository<Entity>(target: ObjectType<Entity> | EntitySchema<Entity> | string): Repository<Entity>;
    /**
     * Gets tree repository for the given entity class or name.
     * Only tree-type entities can have a TreeRepository, like ones decorated with @Tree decorator.
     */
    getTreeRepository<Entity>(target: ObjectType<Entity> | EntitySchema<Entity> | string): TreeRepository<Entity>;
    /**
     * Gets mongodb-specific repository for the given entity class or name.
     * Works only if connection is mongodb-specific.
     */
    getMongoRepository<Entity>(target: ObjectType<Entity> | EntitySchema<Entity> | string): MongoRepository<Entity>;
    /**
     * Gets custom entity repository marked with @EntityRepository decorator.
     */
    getCustomRepository<T>(customRepository: ObjectType<T>): T;
    /**
     * Wraps given function execution (and all operations made there) into a transaction.
     * All database operations must be executed using provided entity manager.
     */
    transaction<T>(runInTransaction: (entityManager: EntityManager) => Promise<T>): Promise<T>;
    transaction<T>(isolationLevel: IsolationLevel, runInTransaction: (entityManager: EntityManager) => Promise<T>): Promise<T>;
    /**
     * Executes raw SQL query and returns raw database results.
     */
    query(query: string, parameters?: any[], queryRunner?: QueryRunner): Promise<any>;
    /**
     * Creates a new query builder that can be used to build a sql query.
     */
    createQueryBuilder<Entity>(entityClass: ObjectType<Entity> | EntitySchema<Entity> | Function | string, alias: string, queryRunner?: QueryRunner): SelectQueryBuilder<Entity>;
    /**
     * Creates a new query builder that can be used to build a sql query.
     */
    createQueryBuilder(queryRunner?: QueryRunner): SelectQueryBuilder<any>;
    /**
     * Creates a query runner used for perform queries on a single database connection.
     * Using query runners you can control your queries to execute using single database connection and
     * manually control your database transaction.
     *
     * Mode is used in replication mode and indicates whatever you want to connect
     * to master database or any of slave databases.
     * If you perform writes you must use master database,
     * if you perform reads you can use slave databases.
     */
    createQueryRunner(mode?: "master" | "slave"): QueryRunner;
    /**
     * Gets entity metadata of the junction table (many-to-many table).
     */
    getManyToManyMetadata(entityTarget: Function | string, relationPropertyPath: string): EntityMetadata | undefined;
    /**
     * Creates an Entity Manager for the current connection with the help of the EntityManagerFactory.
     */
    createEntityManager(queryRunner?: QueryRunner): EntityManager;
    /**
     * Finds exist entity metadata by the given entity class, target name or table name.
     */
    protected findMetadata(target: Function | EntitySchema<any> | string): EntityMetadata | undefined;
    /**
     * Builds metadatas for all registered classes inside this connection.
     */
    protected buildMetadatas(): void;
}
