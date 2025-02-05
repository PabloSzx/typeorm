"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var __1 = require("../../");
var QueryFailedError_1 = require("../../error/QueryFailedError");
var QueryRunnerAlreadyReleasedError_1 = require("../../error/QueryRunnerAlreadyReleasedError");
var TransactionAlreadyStartedError_1 = require("../../error/TransactionAlreadyStartedError");
var TransactionNotStartedError_1 = require("../../error/TransactionNotStartedError");
var BaseQueryRunner_1 = require("../../query-runner/BaseQueryRunner");
var Table_1 = require("../../schema-builder/table/Table");
var TableCheck_1 = require("../../schema-builder/table/TableCheck");
var TableColumn_1 = require("../../schema-builder/table/TableColumn");
var TableExclusion_1 = require("../../schema-builder/table/TableExclusion");
var TableForeignKey_1 = require("../../schema-builder/table/TableForeignKey");
var TableIndex_1 = require("../../schema-builder/table/TableIndex");
var TableUnique_1 = require("../../schema-builder/table/TableUnique");
var View_1 = require("../../schema-builder/view/View");
var Broadcaster_1 = require("../../subscriber/Broadcaster");
var OrmUtils_1 = require("../../util/OrmUtils");
var Query_1 = require("../Query");
/**
 * Runs queries on a single postgres database connection.
 */
var PostgresQueryRunner = /** @class */ (function (_super) {
    tslib_1.__extends(PostgresQueryRunner, _super);
    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    function PostgresQueryRunner(driver, mode) {
        if (mode === void 0) { mode = "master"; }
        var _this = _super.call(this) || this;
        _this.driver = driver;
        _this.connection = driver.connection;
        _this.mode = mode;
        _this.broadcaster = new Broadcaster_1.Broadcaster(_this);
        return _this;
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------
    /**
     * Creates/uses database connection from the connection pool to perform further operations.
     * Returns obtained database connection.
     */
    PostgresQueryRunner.prototype.connect = function () {
        var _this = this;
        if (this.databaseConnection)
            return Promise.resolve(this.databaseConnection);
        if (this.databaseConnectionPromise)
            return this.databaseConnectionPromise;
        if (this.mode === "slave" && this.driver.isReplicated) {
            this.databaseConnectionPromise = this.driver.obtainSlaveConnection().then(function (_a) {
                var _b = tslib_1.__read(_a, 2), connection = _b[0], release = _b[1];
                _this.driver.connectedQueryRunners.push(_this);
                _this.databaseConnection = connection;
                _this.releaseCallback = release;
                return _this.databaseConnection;
            });
        }
        else { // master
            this.databaseConnectionPromise = this.driver.obtainMasterConnection().then(function (_a) {
                var _b = tslib_1.__read(_a, 2), connection = _b[0], release = _b[1];
                _this.driver.connectedQueryRunners.push(_this);
                _this.databaseConnection = connection;
                _this.releaseCallback = release;
                return _this.databaseConnection;
            });
        }
        return this.databaseConnectionPromise;
    };
    /**
     * Releases used database connection.
     * You cannot use query runner methods once its released.
     */
    PostgresQueryRunner.prototype.release = function () {
        this.isReleased = true;
        if (this.releaseCallback)
            this.releaseCallback();
        var index = this.driver.connectedQueryRunners.indexOf(this);
        if (index !== -1)
            this.driver.connectedQueryRunners.splice(index);
        return Promise.resolve();
    };
    /**
     * Starts transaction.
     */
    PostgresQueryRunner.prototype.startTransaction = function (isolationLevel) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isTransactionActive)
                            throw new TransactionAlreadyStartedError_1.TransactionAlreadyStartedError();
                        this.isTransactionActive = true;
                        return [4 /*yield*/, this.query("START TRANSACTION")];
                    case 1:
                        _a.sent();
                        if (!isolationLevel) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.query("SET TRANSACTION ISOLATION LEVEL " + isolationLevel)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Commits transaction.
     * Error will be thrown if transaction was not started.
     */
    PostgresQueryRunner.prototype.commitTransaction = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isTransactionActive)
                            throw new TransactionNotStartedError_1.TransactionNotStartedError();
                        return [4 /*yield*/, this.query("COMMIT")];
                    case 1:
                        _a.sent();
                        this.isTransactionActive = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Rollbacks transaction.
     * Error will be thrown if transaction was not started.
     */
    PostgresQueryRunner.prototype.rollbackTransaction = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.isTransactionActive)
                            throw new TransactionNotStartedError_1.TransactionNotStartedError();
                        return [4 /*yield*/, this.query("ROLLBACK")];
                    case 1:
                        _a.sent();
                        this.isTransactionActive = false;
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Executes a given SQL query.
     */
    PostgresQueryRunner.prototype.query = function (query, parameters) {
        var _this = this;
        if (this.isReleased)
            throw new QueryRunnerAlreadyReleasedError_1.QueryRunnerAlreadyReleasedError();
        return new Promise(function (ok, fail) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var databaseConnection, queryStartTime_1, err_1;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.connect()];
                    case 1:
                        databaseConnection = _a.sent();
                        this.driver.connection.logger.logQuery(query, parameters, this);
                        queryStartTime_1 = +new Date();
                        databaseConnection.query(query, parameters, function (err, result) {
                            // log slow queries if maxQueryExecution time is set
                            var maxQueryExecutionTime = _this.driver.connection.options.maxQueryExecutionTime;
                            var queryEndTime = +new Date();
                            var queryExecutionTime = queryEndTime - queryStartTime_1;
                            if (maxQueryExecutionTime && queryExecutionTime > maxQueryExecutionTime)
                                _this.driver.connection.logger.logQuerySlow(queryExecutionTime, query, parameters, _this);
                            if (err) {
                                _this.driver.connection.logger.logQueryError(err, query, parameters, _this);
                                fail(new QueryFailedError_1.QueryFailedError(query, parameters, err));
                            }
                            else {
                                switch (result.command) {
                                    case "DELETE":
                                    case "UPDATE":
                                        // for UPDATE and DELETE query additionally return number of affected rows
                                        ok([result.rows, result.rowCount]);
                                        break;
                                    default:
                                        ok(result.rows);
                                }
                            }
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        err_1 = _a.sent();
                        fail(err_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
    };
    /**
     * Returns raw data stream.
     */
    PostgresQueryRunner.prototype.stream = function (query, parameters, onEnd, onError) {
        var _this = this;
        var QueryStream = this.driver.loadStreamDependency();
        if (this.isReleased)
            throw new QueryRunnerAlreadyReleasedError_1.QueryRunnerAlreadyReleasedError();
        return new Promise(function (ok, fail) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var databaseConnection, stream, err_2;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.connect()];
                    case 1:
                        databaseConnection = _a.sent();
                        this.driver.connection.logger.logQuery(query, parameters, this);
                        stream = databaseConnection.query(new QueryStream(query, parameters));
                        if (onEnd)
                            stream.on("end", onEnd);
                        if (onError)
                            stream.on("error", onError);
                        ok(stream);
                        return [3 /*break*/, 3];
                    case 2:
                        err_2 = _a.sent();
                        fail(err_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); });
    };
    /**
     * Returns all available database names including system databases.
     */
    PostgresQueryRunner.prototype.getDatabases = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve([])];
            });
        });
    };
    /**
     * Returns all available schema names including system schemas.
     * If database parameter specified, returns schemas of that database.
     */
    PostgresQueryRunner.prototype.getSchemas = function (database) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve([])];
            });
        });
    };
    /**
     * Checks if database with the given name exist.
     */
    PostgresQueryRunner.prototype.hasDatabase = function (database) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve(false)];
            });
        });
    };
    /**
     * Checks if schema with the given name exist.
     */
    PostgresQueryRunner.prototype.hasSchema = function (schema) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.query("SELECT * FROM \"information_schema\".\"schemata\" WHERE \"schema_name\" = '" + schema + "'")];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length ? true : false];
                }
            });
        });
    };
    /**
     * Checks if table with the given name exist in the database.
     */
    PostgresQueryRunner.prototype.hasTable = function (tableOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var parsedTableName, sql, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parsedTableName = this.parseTableName(tableOrName);
                        sql = "SELECT * FROM \"information_schema\".\"tables\" WHERE \"table_schema\" = " + parsedTableName.schema + " AND \"table_name\" = " + parsedTableName.tableName;
                        return [4 /*yield*/, this.query(sql)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length ? true : false];
                }
            });
        });
    };
    /**
     * Checks if column with the given name exist in the given table.
     */
    PostgresQueryRunner.prototype.hasColumn = function (tableOrName, columnName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var parsedTableName, sql, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        parsedTableName = this.parseTableName(tableOrName);
                        sql = "SELECT * FROM \"information_schema\".\"columns\" WHERE \"table_schema\" = " + parsedTableName.schema + " AND \"table_name\" = " + parsedTableName.tableName + " AND \"column_name\" = '" + columnName + "'";
                        return [4 /*yield*/, this.query(sql)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length ? true : false];
                }
            });
        });
    };
    /**
     * Creates a new database.
     * Postgres does not supports database creation inside a transaction block.
     */
    PostgresQueryRunner.prototype.createDatabase = function (database, ifNotExist) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops database.
     * Postgres does not supports database drop inside a transaction block.
     */
    PostgresQueryRunner.prototype.dropDatabase = function (database, ifExist) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, Promise.resolve()];
            });
        });
    };
    /**
     * Creates a new table schema.
     */
    PostgresQueryRunner.prototype.createSchema = function (schema, ifNotExist) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var up, down;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        up = ifNotExist ? "CREATE SCHEMA IF NOT EXISTS \"" + schema + "\"" : "CREATE SCHEMA \"" + schema + "\"";
                        down = "DROP SCHEMA \"" + schema + "\" CASCADE";
                        return [4 /*yield*/, this.executeQueries(new Query_1.Query(up), new Query_1.Query(down))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops table schema.
     */
    PostgresQueryRunner.prototype.dropSchema = function (schemaPath, ifExist, isCascade) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var schema, up, down;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        schema = schemaPath.indexOf(".") === -1 ? schemaPath : schemaPath.split(".")[0];
                        up = ifExist ? "DROP SCHEMA IF EXISTS \"" + schema + "\" " + (isCascade ? "CASCADE" : "") : "DROP SCHEMA \"" + schema + "\" " + (isCascade ? "CASCADE" : "");
                        down = "CREATE SCHEMA \"" + schema + "\"";
                        return [4 /*yield*/, this.executeQueries(new Query_1.Query(up), new Query_1.Query(down))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new table.
     */
    PostgresQueryRunner.prototype.createTable = function (table, ifNotExist, createForeignKeys, createIndices) {
        if (ifNotExist === void 0) { ifNotExist = false; }
        if (createForeignKeys === void 0) { createForeignKeys = true; }
        if (createIndices === void 0) { createIndices = true; }
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var isTableExist, upQueries, downQueries;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!ifNotExist) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.hasTable(table)];
                    case 1:
                        isTableExist = _a.sent();
                        if (isTableExist)
                            return [2 /*return*/, Promise.resolve()];
                        _a.label = 2;
                    case 2:
                        upQueries = [];
                        downQueries = [];
                        // if table have column with ENUM type, we must create this type in postgres.
                        return [4 /*yield*/, Promise.all(table.columns
                                .filter(function (column) { return column.type === "enum" || column.type === "simple-enum"; })
                                .map(function (column) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                var hasEnum;
                                return tslib_1.__generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.hasEnumType(table, column)];
                                        case 1:
                                            hasEnum = _a.sent();
                                            // TODO: Should also check if values of existing type matches expected ones
                                            if (!hasEnum) {
                                                upQueries.push(this.createEnumTypeSql(table, column));
                                                downQueries.push(this.dropEnumTypeSql(table, column));
                                            }
                                            return [2 /*return*/, Promise.resolve()];
                                    }
                                });
                            }); }))];
                    case 3:
                        // if table have column with ENUM type, we must create this type in postgres.
                        _a.sent();
                        upQueries.push(this.createTableSql(table, createForeignKeys));
                        downQueries.push(this.dropTableSql(table));
                        // if createForeignKeys is true, we must drop created foreign keys in down query.
                        // createTable does not need separate method to create foreign keys, because it create fk's in the same query with table creation.
                        if (createForeignKeys)
                            table.foreignKeys.forEach(function (foreignKey) { return downQueries.push(_this.dropForeignKeySql(table, foreignKey)); });
                        if (createIndices) {
                            table.indices.forEach(function (index) {
                                // new index may be passed without name. In this case we generate index name manually.
                                if (!index.name)
                                    index.name = _this.connection.namingStrategy.indexName(table.name, index.columnNames, index.where);
                                upQueries.push(_this.createIndexSql(table, index));
                                downQueries.push(_this.dropIndexSql(table, index));
                            });
                        }
                        return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops the table.
     */
    PostgresQueryRunner.prototype.dropTable = function (target, ifExist, dropForeignKeys, dropIndices) {
        if (dropForeignKeys === void 0) { dropForeignKeys = true; }
        if (dropIndices === void 0) { dropIndices = true; }
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var isTableExist, createForeignKeys, tableName, table, upQueries, downQueries;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!ifExist) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.hasTable(target)];
                    case 1:
                        isTableExist = _a.sent();
                        if (!isTableExist)
                            return [2 /*return*/, Promise.resolve()];
                        _a.label = 2;
                    case 2:
                        createForeignKeys = dropForeignKeys;
                        tableName = target instanceof Table_1.Table ? target.name : target;
                        return [4 /*yield*/, this.getCachedTable(tableName)];
                    case 3:
                        table = _a.sent();
                        upQueries = [];
                        downQueries = [];
                        if (dropIndices) {
                            table.indices.forEach(function (index) {
                                upQueries.push(_this.dropIndexSql(table, index));
                                downQueries.push(_this.createIndexSql(table, index));
                            });
                        }
                        if (dropForeignKeys)
                            table.foreignKeys.forEach(function (foreignKey) { return upQueries.push(_this.dropForeignKeySql(table, foreignKey)); });
                        upQueries.push(this.dropTableSql(table));
                        downQueries.push(this.createTableSql(table, createForeignKeys));
                        return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 4:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new view.
     */
    PostgresQueryRunner.prototype.createView = function (view) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var upQueries, downQueries, _a, _b, _c, _d;
            return tslib_1.__generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        upQueries = [];
                        downQueries = [];
                        upQueries.push(this.createViewSql(view));
                        _b = (_a = upQueries).push;
                        return [4 /*yield*/, this.insertViewDefinitionSql(view)];
                    case 1:
                        _b.apply(_a, [_e.sent()]);
                        downQueries.push(this.dropViewSql(view));
                        _d = (_c = downQueries).push;
                        return [4 /*yield*/, this.deleteViewDefinitionSql(view)];
                    case 2:
                        _d.apply(_c, [_e.sent()]);
                        return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 3:
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops the view.
     */
    PostgresQueryRunner.prototype.dropView = function (target) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var viewName, view, upQueries, downQueries, _a, _b, _c, _d;
            return tslib_1.__generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        viewName = target instanceof View_1.View ? target.name : target;
                        return [4 /*yield*/, this.getCachedView(viewName)];
                    case 1:
                        view = _e.sent();
                        upQueries = [];
                        downQueries = [];
                        _b = (_a = upQueries).push;
                        return [4 /*yield*/, this.deleteViewDefinitionSql(view)];
                    case 2:
                        _b.apply(_a, [_e.sent()]);
                        upQueries.push(this.dropViewSql(view));
                        _d = (_c = downQueries).push;
                        return [4 /*yield*/, this.insertViewDefinitionSql(view)];
                    case 3:
                        _d.apply(_c, [_e.sent()]);
                        downQueries.push(this.createViewSql(view));
                        return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 4:
                        _e.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Renames the given table.
     */
    PostgresQueryRunner.prototype.renameTable = function (oldTableOrName, newTableName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var e_1, _a, upQueries, downQueries, oldTable, _b, newTable, oldTableName, schemaName, columnNames, oldPkName, newPkName, enumColumns, enumColumns_1, enumColumns_1_1, column, oldEnumType, e_1_1;
            var _this = this;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        upQueries = [];
                        downQueries = [];
                        if (!(oldTableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _b = oldTableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(oldTableOrName)];
                    case 2:
                        _b = _c.sent();
                        _c.label = 3;
                    case 3:
                        oldTable = _b;
                        newTable = oldTable.clone();
                        oldTableName = oldTable.name.indexOf(".") === -1 ? oldTable.name : oldTable.name.split(".")[1];
                        schemaName = oldTable.name.indexOf(".") === -1 ? undefined : oldTable.name.split(".")[0];
                        newTable.name = schemaName ? schemaName + "." + newTableName : newTableName;
                        upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(oldTable) + " RENAME TO \"" + newTableName + "\""));
                        downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(newTable) + " RENAME TO \"" + oldTableName + "\""));
                        // rename column primary key constraint
                        if (newTable.primaryColumns.length > 0) {
                            columnNames = newTable.primaryColumns.map(function (column) { return column.name; });
                            oldPkName = this.connection.namingStrategy.primaryKeyName(oldTable, columnNames);
                            newPkName = this.connection.namingStrategy.primaryKeyName(newTable, columnNames);
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(newTable) + " RENAME CONSTRAINT \"" + oldPkName + "\" TO \"" + newPkName + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(newTable) + " RENAME CONSTRAINT \"" + newPkName + "\" TO \"" + oldPkName + "\""));
                        }
                        // rename unique constraints
                        newTable.uniques.forEach(function (unique) {
                            // build new constraint name
                            var newUniqueName = _this.connection.namingStrategy.uniqueConstraintName(newTable, unique.columnNames);
                            // build queries
                            upQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(newTable) + " RENAME CONSTRAINT \"" + unique.name + "\" TO \"" + newUniqueName + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(newTable) + " RENAME CONSTRAINT \"" + newUniqueName + "\" TO \"" + unique.name + "\""));
                            // replace constraint name
                            unique.name = newUniqueName;
                        });
                        // rename index constraints
                        newTable.indices.forEach(function (index) {
                            // build new constraint name
                            var schema = _this.extractSchema(newTable);
                            var newIndexName = _this.connection.namingStrategy.indexName(newTable, index.columnNames, index.where);
                            // build queries
                            var up = schema ? "ALTER INDEX \"" + schema + "\".\"" + index.name + "\" RENAME TO \"" + newIndexName + "\"" : "ALTER INDEX \"" + index.name + "\" RENAME TO \"" + newIndexName + "\"";
                            var down = schema ? "ALTER INDEX \"" + schema + "\".\"" + newIndexName + "\" RENAME TO \"" + index.name + "\"" : "ALTER INDEX \"" + newIndexName + "\" RENAME TO \"" + index.name + "\"";
                            upQueries.push(new Query_1.Query(up));
                            downQueries.push(new Query_1.Query(down));
                            // replace constraint name
                            index.name = newIndexName;
                        });
                        // rename foreign key constraints
                        newTable.foreignKeys.forEach(function (foreignKey) {
                            // build new constraint name
                            var newForeignKeyName = _this.connection.namingStrategy.foreignKeyName(newTable, foreignKey.columnNames);
                            // build queries
                            upQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(newTable) + " RENAME CONSTRAINT \"" + foreignKey.name + "\" TO \"" + newForeignKeyName + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(newTable) + " RENAME CONSTRAINT \"" + newForeignKeyName + "\" TO \"" + foreignKey.name + "\""));
                            // replace constraint name
                            foreignKey.name = newForeignKeyName;
                        });
                        enumColumns = newTable.columns.filter(function (column) { return column.type === "enum" || column.type === "simple-enum"; });
                        _c.label = 4;
                    case 4:
                        _c.trys.push([4, 9, 10, 11]);
                        enumColumns_1 = tslib_1.__values(enumColumns), enumColumns_1_1 = enumColumns_1.next();
                        _c.label = 5;
                    case 5:
                        if (!!enumColumns_1_1.done) return [3 /*break*/, 8];
                        column = enumColumns_1_1.value;
                        return [4 /*yield*/, this.getEnumTypeName(oldTable, column)];
                    case 6:
                        oldEnumType = _c.sent();
                        upQueries.push(new Query_1.Query("ALTER TYPE \"" + oldEnumType.enumTypeSchema + "\".\"" + oldEnumType.enumTypeName + "\" RENAME TO " + this.buildEnumName(newTable, column, false)));
                        downQueries.push(new Query_1.Query("ALTER TYPE " + this.buildEnumName(newTable, column) + " RENAME TO \"" + oldEnumType.enumTypeName + "\""));
                        _c.label = 7;
                    case 7:
                        enumColumns_1_1 = enumColumns_1.next();
                        return [3 /*break*/, 5];
                    case 8: return [3 /*break*/, 11];
                    case 9:
                        e_1_1 = _c.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 11];
                    case 10:
                        try {
                            if (enumColumns_1_1 && !enumColumns_1_1.done && (_a = enumColumns_1.return)) _a.call(enumColumns_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                        return [7 /*endfinally*/];
                    case 11: return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 12:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new column from the column in the table.
     */
    PostgresQueryRunner.prototype.addColumn = function (tableOrName, column) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, clonedTable, upQueries, downQueries, hasEnum, primaryColumns, pkName_1, columnNames_1, pkName, columnNames, columnIndex, uniqueConstraint;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        clonedTable = table.clone();
                        upQueries = [];
                        downQueries = [];
                        if (!(column.type === "enum" || column.type === "simple-enum")) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.hasEnumType(table, column)];
                    case 4:
                        hasEnum = _b.sent();
                        if (!hasEnum) {
                            upQueries.push(this.createEnumTypeSql(table, column));
                            downQueries.push(this.dropEnumTypeSql(table, column));
                        }
                        _b.label = 5;
                    case 5:
                        upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD " + this.buildCreateColumnSql(table, column)));
                        downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP COLUMN \"" + column.name + "\""));
                        // create or update primary key constraint
                        if (column.isPrimary) {
                            primaryColumns = clonedTable.primaryColumns;
                            // if table already have primary key, me must drop it and recreate again
                            if (primaryColumns.length > 0) {
                                pkName_1 = this.connection.namingStrategy.primaryKeyName(clonedTable.name, primaryColumns.map(function (column) { return column.name; }));
                                columnNames_1 = primaryColumns.map(function (column) { return "\"" + column.name + "\""; }).join(", ");
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + pkName_1 + "\""));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + pkName_1 + "\" PRIMARY KEY (" + columnNames_1 + ")"));
                            }
                            primaryColumns.push(column);
                            pkName = this.connection.namingStrategy.primaryKeyName(clonedTable.name, primaryColumns.map(function (column) { return column.name; }));
                            columnNames = primaryColumns.map(function (column) { return "\"" + column.name + "\""; }).join(", ");
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + pkName + "\" PRIMARY KEY (" + columnNames + ")"));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + pkName + "\""));
                        }
                        columnIndex = clonedTable.indices.find(function (index) { return index.columnNames.length === 1 && index.columnNames[0] === column.name; });
                        if (columnIndex) {
                            upQueries.push(this.createIndexSql(table, columnIndex));
                            downQueries.push(this.dropIndexSql(table, columnIndex));
                        }
                        // create unique constraint
                        if (column.isUnique) {
                            uniqueConstraint = new TableUnique_1.TableUnique({
                                name: this.connection.namingStrategy.uniqueConstraintName(table.name, [column.name]),
                                columnNames: [column.name]
                            });
                            clonedTable.uniques.push(uniqueConstraint);
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + uniqueConstraint.name + "\" UNIQUE (\"" + column.name + "\")"));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + uniqueConstraint.name + "\""));
                        }
                        return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 6:
                        _b.sent();
                        clonedTable.addColumn(column);
                        this.replaceCachedTable(table, clonedTable);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new columns from the column in the table.
     */
    PostgresQueryRunner.prototype.addColumns = function (tableOrName, columns) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(columns, function (column) { return _this.addColumn(tableOrName, column); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Renames column in the given table.
     */
    PostgresQueryRunner.prototype.renameColumn = function (tableOrName, oldTableColumnOrName, newTableColumnOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, oldColumn, newColumn;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        oldColumn = oldTableColumnOrName instanceof TableColumn_1.TableColumn ? oldTableColumnOrName : table.columns.find(function (c) { return c.name === oldTableColumnOrName; });
                        if (!oldColumn)
                            throw new Error("Column \"" + oldTableColumnOrName + "\" was not found in the \"" + table.name + "\" table.");
                        if (newTableColumnOrName instanceof TableColumn_1.TableColumn) {
                            newColumn = newTableColumnOrName;
                        }
                        else {
                            newColumn = oldColumn.clone();
                            newColumn.name = newTableColumnOrName;
                        }
                        return [2 /*return*/, this.changeColumn(table, oldColumn, newColumn)];
                }
            });
        });
    };
    /**
     * Changes a column in the table.
     */
    PostgresQueryRunner.prototype.changeColumn = function (tableOrName, oldTableColumnOrName, newColumn) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, clonedTable, upQueries, downQueries, oldColumn, oldEnumType, primaryColumns, columnNames, oldPkName, newPkName, schema, seqName, newSeqName, up, down, oldTableColumn, enumName, arraySuffix, oldEnumName, oldEnumNameWithoutSchema, enumTypeBeforeColumnChange, upType, downType, primaryColumns, pkName, columnNames, column, pkName, columnNames, primaryColumn, column, pkName, columnNames, uniqueConstraint, uniqueConstraint;
            var _this = this;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        clonedTable = table.clone();
                        upQueries = [];
                        downQueries = [];
                        oldColumn = oldTableColumnOrName instanceof TableColumn_1.TableColumn
                            ? oldTableColumnOrName
                            : table.columns.find(function (column) { return column.name === oldTableColumnOrName; });
                        if (!oldColumn)
                            throw new Error("Column \"" + oldTableColumnOrName + "\" was not found in the \"" + table.name + "\" table.");
                        if (!(oldColumn.type !== newColumn.type || oldColumn.length !== newColumn.length)) return [3 /*break*/, 6];
                        // To avoid data conversion, we just recreate column
                        return [4 /*yield*/, this.dropColumn(table, oldColumn)];
                    case 4:
                        // To avoid data conversion, we just recreate column
                        _b.sent();
                        return [4 /*yield*/, this.addColumn(table, newColumn)];
                    case 5:
                        _b.sent();
                        // update cloned table
                        clonedTable = table.clone();
                        return [3 /*break*/, 12];
                    case 6:
                        if (!(oldColumn.name !== newColumn.name)) return [3 /*break*/, 9];
                        // rename column
                        upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " RENAME COLUMN \"" + oldColumn.name + "\" TO \"" + newColumn.name + "\""));
                        downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " RENAME COLUMN \"" + newColumn.name + "\" TO \"" + oldColumn.name + "\""));
                        if (!(oldColumn.type === "enum" || oldColumn.type === "simple-enum")) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.getEnumTypeName(table, oldColumn)];
                    case 7:
                        oldEnumType = _b.sent();
                        upQueries.push(new Query_1.Query("ALTER TYPE \"" + oldEnumType.enumTypeSchema + "\".\"" + oldEnumType.enumTypeName + "\" RENAME TO " + this.buildEnumName(table, newColumn, false)));
                        downQueries.push(new Query_1.Query("ALTER TYPE " + this.buildEnumName(table, newColumn) + " RENAME TO \"" + oldEnumType.enumTypeName + "\""));
                        _b.label = 8;
                    case 8:
                        // rename column primary key constraint
                        if (oldColumn.isPrimary === true) {
                            primaryColumns = clonedTable.primaryColumns;
                            columnNames = primaryColumns.map(function (column) { return column.name; });
                            oldPkName = this.connection.namingStrategy.primaryKeyName(clonedTable, columnNames);
                            // replace old column name with new column name
                            columnNames.splice(columnNames.indexOf(oldColumn.name), 1);
                            columnNames.push(newColumn.name);
                            newPkName = this.connection.namingStrategy.primaryKeyName(clonedTable, columnNames);
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " RENAME CONSTRAINT \"" + oldPkName + "\" TO \"" + newPkName + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " RENAME CONSTRAINT \"" + newPkName + "\" TO \"" + oldPkName + "\""));
                        }
                        // rename column sequence
                        if (oldColumn.isGenerated === true && newColumn.generationStrategy === "increment") {
                            schema = this.extractSchema(table);
                            seqName = this.buildSequenceName(table, oldColumn.name, undefined, true, true);
                            newSeqName = this.buildSequenceName(table, newColumn.name, undefined, true, true);
                            up = schema ? "ALTER SEQUENCE \"" + schema + "\".\"" + seqName + "\" RENAME TO \"" + newSeqName + "\"" : "ALTER SEQUENCE \"" + seqName + "\" RENAME TO \"" + newSeqName + "\"";
                            down = schema ? "ALTER SEQUENCE \"" + schema + "\".\"" + newSeqName + "\" RENAME TO \"" + seqName + "\"" : "ALTER SEQUENCE \"" + newSeqName + "\" RENAME TO \"" + seqName + "\"";
                            upQueries.push(new Query_1.Query(up));
                            downQueries.push(new Query_1.Query(down));
                        }
                        // rename unique constraints
                        clonedTable.findColumnUniques(oldColumn).forEach(function (unique) {
                            // build new constraint name
                            unique.columnNames.splice(unique.columnNames.indexOf(oldColumn.name), 1);
                            unique.columnNames.push(newColumn.name);
                            var newUniqueName = _this.connection.namingStrategy.uniqueConstraintName(clonedTable, unique.columnNames);
                            // build queries
                            upQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(table) + " RENAME CONSTRAINT \"" + unique.name + "\" TO \"" + newUniqueName + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(table) + " RENAME CONSTRAINT \"" + newUniqueName + "\" TO \"" + unique.name + "\""));
                            // replace constraint name
                            unique.name = newUniqueName;
                        });
                        // rename index constraints
                        clonedTable.findColumnIndices(oldColumn).forEach(function (index) {
                            // build new constraint name
                            index.columnNames.splice(index.columnNames.indexOf(oldColumn.name), 1);
                            index.columnNames.push(newColumn.name);
                            var schema = _this.extractSchema(table);
                            var newIndexName = _this.connection.namingStrategy.indexName(clonedTable, index.columnNames, index.where);
                            // build queries
                            var up = schema ? "ALTER INDEX \"" + schema + "\".\"" + index.name + "\" RENAME TO \"" + newIndexName + "\"" : "ALTER INDEX \"" + index.name + "\" RENAME TO \"" + newIndexName + "\"";
                            var down = schema ? "ALTER INDEX \"" + schema + "\".\"" + newIndexName + "\" RENAME TO \"" + index.name + "\"" : "ALTER INDEX \"" + newIndexName + "\" RENAME TO \"" + index.name + "\"";
                            upQueries.push(new Query_1.Query(up));
                            downQueries.push(new Query_1.Query(down));
                            // replace constraint name
                            index.name = newIndexName;
                        });
                        // rename foreign key constraints
                        clonedTable.findColumnForeignKeys(oldColumn).forEach(function (foreignKey) {
                            // build new constraint name
                            foreignKey.columnNames.splice(foreignKey.columnNames.indexOf(oldColumn.name), 1);
                            foreignKey.columnNames.push(newColumn.name);
                            var newForeignKeyName = _this.connection.namingStrategy.foreignKeyName(clonedTable, foreignKey.columnNames);
                            // build queries
                            upQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(table) + " RENAME CONSTRAINT \"" + foreignKey.name + "\" TO \"" + newForeignKeyName + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + _this.escapePath(table) + " RENAME CONSTRAINT \"" + newForeignKeyName + "\" TO \"" + foreignKey.name + "\""));
                            // replace constraint name
                            foreignKey.name = newForeignKeyName;
                        });
                        oldTableColumn = clonedTable.columns.find(function (column) { return column.name === oldColumn.name; });
                        clonedTable.columns[clonedTable.columns.indexOf(oldTableColumn)].name = newColumn.name;
                        oldColumn.name = newColumn.name;
                        _b.label = 9;
                    case 9:
                        if (newColumn.precision !== oldColumn.precision || newColumn.scale !== oldColumn.scale) {
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" TYPE " + this.driver.createFullType(newColumn)));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" TYPE " + this.driver.createFullType(oldColumn)));
                        }
                        if (!((newColumn.type === "enum" || newColumn.type === "simple-enum")
                            && (oldColumn.type === "enum" || oldColumn.type === "simple-enum")
                            && !OrmUtils_1.OrmUtils.isArraysEqual(newColumn.enum, oldColumn.enum))) return [3 /*break*/, 11];
                        enumName = this.buildEnumName(table, newColumn);
                        arraySuffix = newColumn.isArray ? "[]" : "";
                        oldEnumName = this.buildEnumName(table, newColumn, true, false, true);
                        oldEnumNameWithoutSchema = this.buildEnumName(table, newColumn, false, false, true);
                        return [4 /*yield*/, this.getEnumTypeName(table, oldColumn)];
                    case 10:
                        enumTypeBeforeColumnChange = _b.sent();
                        // rename old ENUM
                        upQueries.push(new Query_1.Query("ALTER TYPE \"" + enumTypeBeforeColumnChange.enumTypeSchema + "\".\"" + enumTypeBeforeColumnChange.enumTypeName + "\" RENAME TO " + oldEnumNameWithoutSchema));
                        downQueries.push(new Query_1.Query("ALTER TYPE " + oldEnumName + " RENAME TO  \"" + enumTypeBeforeColumnChange.enumTypeName + "\""));
                        // create new ENUM
                        upQueries.push(this.createEnumTypeSql(table, newColumn));
                        downQueries.push(this.dropEnumTypeSql(table, oldColumn));
                        // if column have default value, we must drop it to avoid issues with type casting
                        if (newColumn.default !== null && newColumn.default !== undefined) {
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" DROP DEFAULT"));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" SET DEFAULT " + newColumn.default));
                        }
                        upType = "" + enumName + arraySuffix + " USING \"" + newColumn.name + "\"::\"text\"::" + enumName + arraySuffix;
                        downType = "" + oldEnumName + arraySuffix + " USING \"" + newColumn.name + "\"::\"text\"::" + oldEnumName + arraySuffix;
                        // update column to use new type
                        upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" TYPE " + upType));
                        downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" TYPE " + downType));
                        // if column have default value and we dropped it before, we must bring it back
                        if (newColumn.default !== null && newColumn.default !== undefined) {
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" SET DEFAULT " + newColumn.default));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" DROP DEFAULT"));
                        }
                        // remove old ENUM
                        upQueries.push(this.dropEnumTypeSql(table, newColumn, oldEnumName));
                        downQueries.push(this.createEnumTypeSql(table, oldColumn, oldEnumName));
                        _b.label = 11;
                    case 11:
                        if (oldColumn.isNullable !== newColumn.isNullable) {
                            if (newColumn.isNullable) {
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + oldColumn.name + "\" DROP NOT NULL"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + oldColumn.name + "\" SET NOT NULL"));
                            }
                            else {
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + oldColumn.name + "\" SET NOT NULL"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + oldColumn.name + "\" DROP NOT NULL"));
                            }
                        }
                        if (oldColumn.comment !== newColumn.comment) {
                            upQueries.push(new Query_1.Query("COMMENT ON COLUMN " + this.escapePath(table) + ".\"" + oldColumn.name + "\" IS '" + newColumn.comment + "'"));
                            downQueries.push(new Query_1.Query("COMMENT ON COLUMN " + this.escapePath(table) + ".\"" + newColumn.name + "\" IS '" + oldColumn.comment + "'"));
                        }
                        if (newColumn.isPrimary !== oldColumn.isPrimary) {
                            primaryColumns = clonedTable.primaryColumns;
                            // if primary column state changed, we must always drop existed constraint.
                            if (primaryColumns.length > 0) {
                                pkName = this.connection.namingStrategy.primaryKeyName(clonedTable.name, primaryColumns.map(function (column) { return column.name; }));
                                columnNames = primaryColumns.map(function (column) { return "\"" + column.name + "\""; }).join(", ");
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + pkName + "\""));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + pkName + "\" PRIMARY KEY (" + columnNames + ")"));
                            }
                            if (newColumn.isPrimary === true) {
                                primaryColumns.push(newColumn);
                                column = clonedTable.columns.find(function (column) { return column.name === newColumn.name; });
                                column.isPrimary = true;
                                pkName = this.connection.namingStrategy.primaryKeyName(clonedTable.name, primaryColumns.map(function (column) { return column.name; }));
                                columnNames = primaryColumns.map(function (column) { return "\"" + column.name + "\""; }).join(", ");
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + pkName + "\" PRIMARY KEY (" + columnNames + ")"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + pkName + "\""));
                            }
                            else {
                                primaryColumn = primaryColumns.find(function (c) { return c.name === newColumn.name; });
                                primaryColumns.splice(primaryColumns.indexOf(primaryColumn), 1);
                                column = clonedTable.columns.find(function (column) { return column.name === newColumn.name; });
                                column.isPrimary = false;
                                // if we have another primary keys, we must recreate constraint.
                                if (primaryColumns.length > 0) {
                                    pkName = this.connection.namingStrategy.primaryKeyName(clonedTable.name, primaryColumns.map(function (column) { return column.name; }));
                                    columnNames = primaryColumns.map(function (column) { return "\"" + column.name + "\""; }).join(", ");
                                    upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + pkName + "\" PRIMARY KEY (" + columnNames + ")"));
                                    downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + pkName + "\""));
                                }
                            }
                        }
                        if (newColumn.isUnique !== oldColumn.isUnique) {
                            if (newColumn.isUnique === true) {
                                uniqueConstraint = new TableUnique_1.TableUnique({
                                    name: this.connection.namingStrategy.uniqueConstraintName(table.name, [newColumn.name]),
                                    columnNames: [newColumn.name]
                                });
                                clonedTable.uniques.push(uniqueConstraint);
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + uniqueConstraint.name + "\" UNIQUE (\"" + newColumn.name + "\")"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + uniqueConstraint.name + "\""));
                            }
                            else {
                                uniqueConstraint = clonedTable.uniques.find(function (unique) {
                                    return unique.columnNames.length === 1 && !!unique.columnNames.find(function (columnName) { return columnName === newColumn.name; });
                                });
                                clonedTable.uniques.splice(clonedTable.uniques.indexOf(uniqueConstraint), 1);
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + uniqueConstraint.name + "\""));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + uniqueConstraint.name + "\" UNIQUE (\"" + newColumn.name + "\")"));
                            }
                        }
                        if (oldColumn.isGenerated !== newColumn.isGenerated && newColumn.generationStrategy !== "uuid") {
                            if (newColumn.isGenerated === true) {
                                upQueries.push(new Query_1.Query("CREATE SEQUENCE " + this.buildSequenceName(table, newColumn) + " OWNED BY " + this.escapePath(table) + ".\"" + newColumn.name + "\""));
                                downQueries.push(new Query_1.Query("DROP SEQUENCE " + this.buildSequenceName(table, newColumn)));
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" SET DEFAULT nextval('" + this.buildSequenceName(table, newColumn, undefined, true) + "')"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" DROP DEFAULT"));
                            }
                            else {
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" DROP DEFAULT"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" SET DEFAULT nextval('" + this.buildSequenceName(table, newColumn, undefined, true) + "')"));
                                upQueries.push(new Query_1.Query("DROP SEQUENCE " + this.buildSequenceName(table, newColumn)));
                                downQueries.push(new Query_1.Query("CREATE SEQUENCE " + this.buildSequenceName(table, newColumn) + " OWNED BY " + this.escapePath(table) + ".\"" + newColumn.name + "\""));
                            }
                        }
                        if (newColumn.default !== oldColumn.default) {
                            if (newColumn.default !== null && newColumn.default !== undefined) {
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" SET DEFAULT " + newColumn.default));
                                if (oldColumn.default !== null && oldColumn.default !== undefined) {
                                    downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" SET DEFAULT " + oldColumn.default));
                                }
                                else {
                                    downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" DROP DEFAULT"));
                                }
                            }
                            else if (oldColumn.default !== null && oldColumn.default !== undefined) {
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" DROP DEFAULT"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" SET DEFAULT " + oldColumn.default));
                            }
                        }
                        if ((newColumn.spatialFeatureType || "").toLowerCase() !== (oldColumn.spatialFeatureType || "").toLowerCase() || newColumn.srid !== oldColumn.srid) {
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" TYPE " + this.driver.createFullType(newColumn)));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ALTER COLUMN \"" + newColumn.name + "\" TYPE " + this.driver.createFullType(oldColumn)));
                        }
                        _b.label = 12;
                    case 12: return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 13:
                        _b.sent();
                        this.replaceCachedTable(table, clonedTable);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Changes a column in the table.
     */
    PostgresQueryRunner.prototype.changeColumns = function (tableOrName, changedColumns) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(changedColumns, function (changedColumn) { return _this.changeColumn(tableOrName, changedColumn.oldColumn, changedColumn.newColumn); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops column in the table.
     */
    PostgresQueryRunner.prototype.dropColumn = function (tableOrName, columnOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, column, clonedTable, upQueries, downQueries, pkName, columnNames, tableColumn, pkName_2, columnNames_2, columnIndex, columnCheck, columnUnique, hasEnum, enumType, escapedEnumName;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        column = columnOrName instanceof TableColumn_1.TableColumn ? columnOrName : table.findColumnByName(columnOrName);
                        if (!column)
                            throw new Error("Column \"" + columnOrName + "\" was not found in table \"" + table.name + "\"");
                        clonedTable = table.clone();
                        upQueries = [];
                        downQueries = [];
                        // drop primary key constraint
                        if (column.isPrimary) {
                            pkName = this.connection.namingStrategy.primaryKeyName(clonedTable.name, clonedTable.primaryColumns.map(function (column) { return column.name; }));
                            columnNames = clonedTable.primaryColumns.map(function (primaryColumn) { return "\"" + primaryColumn.name + "\""; }).join(", ");
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(clonedTable) + " DROP CONSTRAINT \"" + pkName + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(clonedTable) + " ADD CONSTRAINT \"" + pkName + "\" PRIMARY KEY (" + columnNames + ")"));
                            tableColumn = clonedTable.findColumnByName(column.name);
                            tableColumn.isPrimary = false;
                            // if primary key have multiple columns, we must recreate it without dropped column
                            if (clonedTable.primaryColumns.length > 0) {
                                pkName_2 = this.connection.namingStrategy.primaryKeyName(clonedTable.name, clonedTable.primaryColumns.map(function (column) { return column.name; }));
                                columnNames_2 = clonedTable.primaryColumns.map(function (primaryColumn) { return "\"" + primaryColumn.name + "\""; }).join(", ");
                                upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(clonedTable) + " ADD CONSTRAINT \"" + pkName_2 + "\" PRIMARY KEY (" + columnNames_2 + ")"));
                                downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(clonedTable) + " DROP CONSTRAINT \"" + pkName_2 + "\""));
                            }
                        }
                        columnIndex = clonedTable.indices.find(function (index) { return index.columnNames.length === 1 && index.columnNames[0] === column.name; });
                        if (columnIndex) {
                            clonedTable.indices.splice(clonedTable.indices.indexOf(columnIndex), 1);
                            upQueries.push(this.dropIndexSql(table, columnIndex));
                            downQueries.push(this.createIndexSql(table, columnIndex));
                        }
                        columnCheck = clonedTable.checks.find(function (check) { return !!check.columnNames && check.columnNames.length === 1 && check.columnNames[0] === column.name; });
                        if (columnCheck) {
                            clonedTable.checks.splice(clonedTable.checks.indexOf(columnCheck), 1);
                            upQueries.push(this.dropCheckConstraintSql(table, columnCheck));
                            downQueries.push(this.createCheckConstraintSql(table, columnCheck));
                        }
                        columnUnique = clonedTable.uniques.find(function (unique) { return unique.columnNames.length === 1 && unique.columnNames[0] === column.name; });
                        if (columnUnique) {
                            clonedTable.uniques.splice(clonedTable.uniques.indexOf(columnUnique), 1);
                            upQueries.push(this.dropUniqueConstraintSql(table, columnUnique));
                            downQueries.push(this.createUniqueConstraintSql(table, columnUnique));
                        }
                        upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP COLUMN \"" + column.name + "\""));
                        downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD " + this.buildCreateColumnSql(table, column)));
                        if (!(column.type === "enum" || column.type === "simple-enum")) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.hasEnumType(table, column)];
                    case 4:
                        hasEnum = _b.sent();
                        if (!hasEnum) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.getEnumTypeName(table, column)];
                    case 5:
                        enumType = _b.sent();
                        escapedEnumName = "\"" + enumType.enumTypeSchema + "\".\"" + enumType.enumTypeName + "\"";
                        upQueries.push(this.dropEnumTypeSql(table, column, escapedEnumName));
                        downQueries.push(this.createEnumTypeSql(table, column, escapedEnumName));
                        _b.label = 6;
                    case 6: return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 7:
                        _b.sent();
                        clonedTable.removeColumn(column);
                        this.replaceCachedTable(table, clonedTable);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops the columns in the table.
     */
    PostgresQueryRunner.prototype.dropColumns = function (tableOrName, columns) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(columns, function (column) { return _this.dropColumn(tableOrName, column); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new primary key.
     */
    PostgresQueryRunner.prototype.createPrimaryKey = function (tableOrName, columnNames) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, clonedTable, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        clonedTable = table.clone();
                        up = this.createPrimaryKeySql(table, columnNames);
                        // mark columns as primary, because dropPrimaryKeySql build constraint name from table primary column names.
                        clonedTable.columns.forEach(function (column) {
                            if (columnNames.find(function (columnName) { return columnName === column.name; }))
                                column.isPrimary = true;
                        });
                        down = this.dropPrimaryKeySql(clonedTable);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        this.replaceCachedTable(table, clonedTable);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Updates composite primary keys.
     */
    PostgresQueryRunner.prototype.updatePrimaryKeys = function (tableOrName, columns) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, clonedTable, columnNames, upQueries, downQueries, primaryColumns, pkName_3, columnNamesString_1, pkName, columnNamesString;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        clonedTable = table.clone();
                        columnNames = columns.map(function (column) { return column.name; });
                        upQueries = [];
                        downQueries = [];
                        primaryColumns = clonedTable.primaryColumns;
                        if (primaryColumns.length > 0) {
                            pkName_3 = this.connection.namingStrategy.primaryKeyName(clonedTable.name, primaryColumns.map(function (column) { return column.name; }));
                            columnNamesString_1 = primaryColumns.map(function (column) { return "\"" + column.name + "\""; }).join(", ");
                            upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + pkName_3 + "\""));
                            downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + pkName_3 + "\" PRIMARY KEY (" + columnNamesString_1 + ")"));
                        }
                        // update columns in table.
                        clonedTable.columns
                            .filter(function (column) { return columnNames.indexOf(column.name) !== -1; })
                            .forEach(function (column) { return column.isPrimary = true; });
                        pkName = this.connection.namingStrategy.primaryKeyName(clonedTable.name, columnNames);
                        columnNamesString = columnNames.map(function (columnName) { return "\"" + columnName + "\""; }).join(", ");
                        upQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + pkName + "\" PRIMARY KEY (" + columnNamesString + ")"));
                        downQueries.push(new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + pkName + "\""));
                        return [4 /*yield*/, this.executeQueries(upQueries, downQueries)];
                    case 4:
                        _b.sent();
                        this.replaceCachedTable(table, clonedTable);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops a primary key.
     */
    PostgresQueryRunner.prototype.dropPrimaryKey = function (tableOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        up = this.dropPrimaryKeySql(table);
                        down = this.createPrimaryKeySql(table, table.primaryColumns.map(function (column) { return column.name; }));
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.primaryColumns.forEach(function (column) {
                            column.isPrimary = false;
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates new unique constraint.
     */
    PostgresQueryRunner.prototype.createUniqueConstraint = function (tableOrName, uniqueConstraint) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        // new unique constraint may be passed without name. In this case we generate unique name manually.
                        if (!uniqueConstraint.name)
                            uniqueConstraint.name = this.connection.namingStrategy.uniqueConstraintName(table.name, uniqueConstraint.columnNames);
                        up = this.createUniqueConstraintSql(table, uniqueConstraint);
                        down = this.dropUniqueConstraintSql(table, uniqueConstraint);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.addUniqueConstraint(uniqueConstraint);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates new unique constraints.
     */
    PostgresQueryRunner.prototype.createUniqueConstraints = function (tableOrName, uniqueConstraints) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(uniqueConstraints, function (uniqueConstraint) { return _this.createUniqueConstraint(tableOrName, uniqueConstraint); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops unique constraint.
     */
    PostgresQueryRunner.prototype.dropUniqueConstraint = function (tableOrName, uniqueOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, uniqueConstraint, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        uniqueConstraint = uniqueOrName instanceof TableUnique_1.TableUnique ? uniqueOrName : table.uniques.find(function (u) { return u.name === uniqueOrName; });
                        if (!uniqueConstraint)
                            throw new Error("Supplied unique constraint was not found in table " + table.name);
                        up = this.dropUniqueConstraintSql(table, uniqueConstraint);
                        down = this.createUniqueConstraintSql(table, uniqueConstraint);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.removeUniqueConstraint(uniqueConstraint);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops unique constraints.
     */
    PostgresQueryRunner.prototype.dropUniqueConstraints = function (tableOrName, uniqueConstraints) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(uniqueConstraints, function (uniqueConstraint) { return _this.dropUniqueConstraint(tableOrName, uniqueConstraint); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates new check constraint.
     */
    PostgresQueryRunner.prototype.createCheckConstraint = function (tableOrName, checkConstraint) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        // new unique constraint may be passed without name. In this case we generate unique name manually.
                        if (!checkConstraint.name)
                            checkConstraint.name = this.connection.namingStrategy.checkConstraintName(table.name, checkConstraint.expression);
                        up = this.createCheckConstraintSql(table, checkConstraint);
                        down = this.dropCheckConstraintSql(table, checkConstraint);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.addCheckConstraint(checkConstraint);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates new check constraints.
     */
    PostgresQueryRunner.prototype.createCheckConstraints = function (tableOrName, checkConstraints) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var promises;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promises = checkConstraints.map(function (checkConstraint) { return _this.createCheckConstraint(tableOrName, checkConstraint); });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops check constraint.
     */
    PostgresQueryRunner.prototype.dropCheckConstraint = function (tableOrName, checkOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, checkConstraint, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        checkConstraint = checkOrName instanceof TableCheck_1.TableCheck ? checkOrName : table.checks.find(function (c) { return c.name === checkOrName; });
                        if (!checkConstraint)
                            throw new Error("Supplied check constraint was not found in table " + table.name);
                        up = this.dropCheckConstraintSql(table, checkConstraint);
                        down = this.createCheckConstraintSql(table, checkConstraint);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.removeCheckConstraint(checkConstraint);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops check constraints.
     */
    PostgresQueryRunner.prototype.dropCheckConstraints = function (tableOrName, checkConstraints) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var promises;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promises = checkConstraints.map(function (checkConstraint) { return _this.dropCheckConstraint(tableOrName, checkConstraint); });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates new exclusion constraint.
     */
    PostgresQueryRunner.prototype.createExclusionConstraint = function (tableOrName, exclusionConstraint) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        // new unique constraint may be passed without name. In this case we generate unique name manually.
                        if (!exclusionConstraint.name)
                            exclusionConstraint.name = this.connection.namingStrategy.exclusionConstraintName(table.name, exclusionConstraint.expression);
                        up = this.createExclusionConstraintSql(table, exclusionConstraint);
                        down = this.dropExclusionConstraintSql(table, exclusionConstraint);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.addExclusionConstraint(exclusionConstraint);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates new exclusion constraints.
     */
    PostgresQueryRunner.prototype.createExclusionConstraints = function (tableOrName, exclusionConstraints) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var promises;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promises = exclusionConstraints.map(function (exclusionConstraint) { return _this.createExclusionConstraint(tableOrName, exclusionConstraint); });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops exclusion constraint.
     */
    PostgresQueryRunner.prototype.dropExclusionConstraint = function (tableOrName, exclusionOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, exclusionConstraint, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        exclusionConstraint = exclusionOrName instanceof TableExclusion_1.TableExclusion ? exclusionOrName : table.exclusions.find(function (c) { return c.name === exclusionOrName; });
                        if (!exclusionConstraint)
                            throw new Error("Supplied exclusion constraint was not found in table " + table.name);
                        up = this.dropExclusionConstraintSql(table, exclusionConstraint);
                        down = this.createExclusionConstraintSql(table, exclusionConstraint);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.removeExclusionConstraint(exclusionConstraint);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops exclusion constraints.
     */
    PostgresQueryRunner.prototype.dropExclusionConstraints = function (tableOrName, exclusionConstraints) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var promises;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        promises = exclusionConstraints.map(function (exclusionConstraint) { return _this.dropExclusionConstraint(tableOrName, exclusionConstraint); });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new foreign key.
     */
    PostgresQueryRunner.prototype.createForeignKey = function (tableOrName, foreignKey) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        // new FK may be passed without name. In this case we generate FK name manually.
                        if (!foreignKey.name)
                            foreignKey.name = this.connection.namingStrategy.foreignKeyName(table.name, foreignKey.columnNames);
                        up = this.createForeignKeySql(table, foreignKey);
                        down = this.dropForeignKeySql(table, foreignKey);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.addForeignKey(foreignKey);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new foreign keys.
     */
    PostgresQueryRunner.prototype.createForeignKeys = function (tableOrName, foreignKeys) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(foreignKeys, function (foreignKey) { return _this.createForeignKey(tableOrName, foreignKey); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops a foreign key from the table.
     */
    PostgresQueryRunner.prototype.dropForeignKey = function (tableOrName, foreignKeyOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, foreignKey, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        foreignKey = foreignKeyOrName instanceof TableForeignKey_1.TableForeignKey ? foreignKeyOrName : table.foreignKeys.find(function (fk) { return fk.name === foreignKeyOrName; });
                        if (!foreignKey)
                            throw new Error("Supplied foreign key was not found in table " + table.name);
                        up = this.dropForeignKeySql(table, foreignKey);
                        down = this.createForeignKeySql(table, foreignKey);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.removeForeignKey(foreignKey);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops a foreign keys from the table.
     */
    PostgresQueryRunner.prototype.dropForeignKeys = function (tableOrName, foreignKeys) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(foreignKeys, function (foreignKey) { return _this.dropForeignKey(tableOrName, foreignKey); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new index.
     */
    PostgresQueryRunner.prototype.createIndex = function (tableOrName, index) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        // new index may be passed without name. In this case we generate index name manually.
                        if (!index.name)
                            index.name = this.connection.namingStrategy.indexName(table.name, index.columnNames, index.where);
                        up = this.createIndexSql(table, index);
                        down = this.dropIndexSql(table, index);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.addIndex(index);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Creates a new indices
     */
    PostgresQueryRunner.prototype.createIndices = function (tableOrName, indices) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(indices, function (index) { return _this.createIndex(tableOrName, index); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops an index from the table.
     */
    PostgresQueryRunner.prototype.dropIndex = function (tableOrName, indexOrName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var table, _a, index, up, down;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(tableOrName instanceof Table_1.Table)) return [3 /*break*/, 1];
                        _a = tableOrName;
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.getCachedTable(tableOrName)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        table = _a;
                        index = indexOrName instanceof TableIndex_1.TableIndex ? indexOrName : table.indices.find(function (i) { return i.name === indexOrName; });
                        if (!index)
                            throw new Error("Supplied index was not found in table " + table.name);
                        up = this.dropIndexSql(table, index);
                        down = this.createIndexSql(table, index);
                        return [4 /*yield*/, this.executeQueries(up, down)];
                    case 4:
                        _b.sent();
                        table.removeIndex(index);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Drops an indices from the table.
     */
    PostgresQueryRunner.prototype.dropIndices = function (tableOrName, indices) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __1.PromiseUtils.runInSequence(indices, function (index) { return _this.dropIndex(tableOrName, index); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clears all table contents.
     * Note: this operation uses SQL's TRUNCATE query which cannot be reverted in transactions.
     */
    PostgresQueryRunner.prototype.clearTable = function (tableName) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.query("TRUNCATE TABLE " + this.escapePath(tableName))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Removes all tables from the currently connected database.
     */
    PostgresQueryRunner.prototype.clearDatabase = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var schemas, schemaNamesString, selectViewDropsQuery, dropViewQueries, selectTableDropsQuery, dropTableQueries, error_1, rollbackError_1;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        schemas = [];
                        this.connection.entityMetadatas
                            .filter(function (metadata) { return metadata.schema; })
                            .forEach(function (metadata) {
                            var isSchemaExist = !!schemas.find(function (schema) { return schema === metadata.schema; });
                            if (!isSchemaExist)
                                schemas.push(metadata.schema);
                        });
                        schemas.push(this.driver.options.schema || "current_schema()");
                        schemaNamesString = schemas.map(function (name) {
                            return name === "current_schema()" ? name : "'" + name + "'";
                        }).join(", ");
                        return [4 /*yield*/, this.startTransaction()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 9, , 14]);
                        selectViewDropsQuery = "SELECT 'DROP VIEW IF EXISTS \"' || schemaname || '\".\"' || viewname || '\" CASCADE;' as \"query\" " +
                            ("FROM \"pg_views\" WHERE \"schemaname\" IN (" + schemaNamesString + ") AND \"viewname\" NOT IN ('geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews')");
                        return [4 /*yield*/, this.query(selectViewDropsQuery)];
                    case 3:
                        dropViewQueries = _a.sent();
                        return [4 /*yield*/, Promise.all(dropViewQueries.map(function (q) { return _this.query(q["query"]); }))];
                    case 4:
                        _a.sent();
                        selectTableDropsQuery = "SELECT 'DROP TABLE IF EXISTS \"' || schemaname || '\".\"' || tablename || '\" CASCADE;' as \"query\" FROM \"pg_tables\" WHERE \"schemaname\" IN (" + schemaNamesString + ") AND \"tablename\" NOT IN ('spatial_ref_sys')";
                        return [4 /*yield*/, this.query(selectTableDropsQuery)];
                    case 5:
                        dropTableQueries = _a.sent();
                        return [4 /*yield*/, Promise.all(dropTableQueries.map(function (q) { return _this.query(q["query"]); }))];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, this.dropEnumTypes(schemaNamesString)];
                    case 7:
                        _a.sent();
                        return [4 /*yield*/, this.commitTransaction()];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 14];
                    case 9:
                        error_1 = _a.sent();
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.rollbackTransaction()];
                    case 11:
                        _a.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        rollbackError_1 = _a.sent();
                        return [3 /*break*/, 13];
                    case 13: throw error_1;
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------
    PostgresQueryRunner.prototype.loadViews = function (viewNames) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var hasTable, currentSchemaQuery, currentSchema, viewsCondition, query, dbViews;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.hasTable(this.getTypeormMetadataTableName())];
                    case 1:
                        hasTable = _a.sent();
                        if (!hasTable)
                            return [2 /*return*/, Promise.resolve([])];
                        return [4 /*yield*/, this.query("SELECT * FROM current_schema()")];
                    case 2:
                        currentSchemaQuery = _a.sent();
                        currentSchema = currentSchemaQuery[0]["current_schema"];
                        viewsCondition = viewNames.map(function (viewName) {
                            var _a = tslib_1.__read(viewName.split("."), 2), schema = _a[0], name = _a[1];
                            if (!name) {
                                name = schema;
                                schema = _this.driver.options.schema || currentSchema;
                            }
                            return "(\"t\".\"schema\" = '" + schema + "' AND \"t\".\"name\" = '" + name + "')";
                        }).join(" OR ");
                        query = "SELECT \"t\".*, \"v\".\"check_option\" FROM " + this.escapePath(this.getTypeormMetadataTableName()) + " \"t\" " +
                            ("INNER JOIN \"information_schema\".\"views\" \"v\" ON \"v\".\"table_schema\" = \"t\".\"schema\" AND \"v\".\"table_name\" = \"t\".\"name\" WHERE \"t\".\"type\" = 'VIEW' " + (viewsCondition ? "AND (" + viewsCondition + ")" : ""));
                        return [4 /*yield*/, this.query(query)];
                    case 3:
                        dbViews = _a.sent();
                        return [2 /*return*/, dbViews.map(function (dbView) {
                                var view = new View_1.View();
                                var schema = dbView["schema"] === currentSchema && !_this.driver.options.schema ? undefined : dbView["schema"];
                                view.name = _this.driver.buildTableName(dbView["name"], schema);
                                view.expression = dbView["value"];
                                return view;
                            })];
                }
            });
        });
    };
    /**
     * Loads all tables (with given names) from the database and creates a Table from them.
     */
    PostgresQueryRunner.prototype.loadTables = function (tableNames) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var currentSchemaQuery, currentSchema, tablesCondition, tablesSql, columnsSql, constraintsCondition, constraintsSql, indicesSql, foreignKeysCondition, foreignKeysSql, _a, dbTables, dbColumns, dbConstraints, dbIndices, dbForeignKeys;
            var _this = this;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        // if no tables given then no need to proceed
                        if (!tableNames || !tableNames.length)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, this.query("SELECT * FROM current_schema()")];
                    case 1:
                        currentSchemaQuery = _b.sent();
                        currentSchema = currentSchemaQuery[0]["current_schema"];
                        tablesCondition = tableNames.map(function (tableName) {
                            var _a = tslib_1.__read(tableName.split("."), 2), schema = _a[0], name = _a[1];
                            if (!name) {
                                name = schema;
                                schema = _this.driver.options.schema || currentSchema;
                            }
                            return "(\"table_schema\" = '" + schema + "' AND \"table_name\" = '" + name + "')";
                        }).join(" OR ");
                        tablesSql = "SELECT * FROM \"information_schema\".\"tables\" WHERE " + tablesCondition;
                        columnsSql = "SELECT *, ('\"' || \"udt_schema\" || '\".\"' || \"udt_name\" || '\"')::\"regtype\" AS \"regtype\" FROM \"information_schema\".\"columns\" WHERE " + tablesCondition;
                        constraintsCondition = tableNames.map(function (tableName) {
                            var _a = tslib_1.__read(tableName.split("."), 2), schema = _a[0], name = _a[1];
                            if (!name) {
                                name = schema;
                                schema = _this.driver.options.schema || currentSchema;
                            }
                            return "(\"ns\".\"nspname\" = '" + schema + "' AND \"t\".\"relname\" = '" + name + "')";
                        }).join(" OR ");
                        constraintsSql = "SELECT \"ns\".\"nspname\" AS \"table_schema\", \"t\".\"relname\" AS \"table_name\", \"cnst\".\"conname\" AS \"constraint_name\", " +
                            "CASE \"cnst\".\"contype\" WHEN 'x' THEN pg_get_constraintdef(\"cnst\".\"oid\", true) ELSE \"cnst\".\"consrc\" END AS \"expression\", " +
                            "CASE \"cnst\".\"contype\" WHEN 'p' THEN 'PRIMARY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'x' THEN 'EXCLUDE' END AS \"constraint_type\", \"a\".\"attname\" AS \"column_name\" " +
                            "FROM \"pg_constraint\" \"cnst\" " +
                            "INNER JOIN \"pg_class\" \"t\" ON \"t\".\"oid\" = \"cnst\".\"conrelid\" " +
                            "INNER JOIN \"pg_namespace\" \"ns\" ON \"ns\".\"oid\" = \"cnst\".\"connamespace\" " +
                            "LEFT JOIN \"pg_attribute\" \"a\" ON \"a\".\"attrelid\" = \"cnst\".\"conrelid\" AND \"a\".\"attnum\" = ANY (\"cnst\".\"conkey\") " +
                            ("WHERE \"t\".\"relkind\" = 'r' AND (" + constraintsCondition + ")");
                        indicesSql = "SELECT \"ns\".\"nspname\" AS \"table_schema\", \"t\".\"relname\" AS \"table_name\", \"i\".\"relname\" AS \"constraint_name\", \"a\".\"attname\" AS \"column_name\", " +
                            "CASE \"ix\".\"indisunique\" WHEN 't' THEN 'TRUE' ELSE'FALSE' END AS \"is_unique\", pg_get_expr(\"ix\".\"indpred\", \"ix\".\"indrelid\") AS \"condition\", " +
                            "\"types\".\"typname\" AS \"type_name\" " +
                            "FROM \"pg_class\" \"t\" " +
                            "INNER JOIN \"pg_index\" \"ix\" ON \"ix\".\"indrelid\" = \"t\".\"oid\" " +
                            "INNER JOIN \"pg_attribute\" \"a\" ON \"a\".\"attrelid\" = \"t\".\"oid\"  AND \"a\".\"attnum\" = ANY (\"ix\".\"indkey\") " +
                            "INNER JOIN \"pg_namespace\" \"ns\" ON \"ns\".\"oid\" = \"t\".\"relnamespace\" " +
                            "INNER JOIN \"pg_class\" \"i\" ON \"i\".\"oid\" = \"ix\".\"indexrelid\" " +
                            "INNER JOIN \"pg_type\" \"types\" ON \"types\".\"oid\" = \"a\".\"atttypid\" " +
                            "LEFT JOIN \"pg_constraint\" \"cnst\" ON \"cnst\".\"conname\" = \"i\".\"relname\" " +
                            ("WHERE \"t\".\"relkind\" = 'r' AND \"cnst\".\"contype\" IS NULL AND (" + constraintsCondition + ")");
                        foreignKeysCondition = tableNames.map(function (tableName) {
                            var _a = tslib_1.__read(tableName.split("."), 2), schema = _a[0], name = _a[1];
                            if (!name) {
                                name = schema;
                                schema = _this.driver.options.schema || currentSchema;
                            }
                            return "(\"ns\".\"nspname\" = '" + schema + "' AND \"cl\".\"relname\" = '" + name + "')";
                        }).join(" OR ");
                        foreignKeysSql = "SELECT \"con\".\"conname\" AS \"constraint_name\", \"con\".\"nspname\" AS \"table_schema\", \"con\".\"relname\" AS \"table_name\", \"att2\".\"attname\" AS \"column_name\", " +
                            "\"ns\".\"nspname\" AS \"referenced_table_schema\", \"cl\".\"relname\" AS \"referenced_table_name\", \"att\".\"attname\" AS \"referenced_column_name\", \"con\".\"confdeltype\" AS \"on_delete\", " +
                            "\"con\".\"confupdtype\" AS \"on_update\", \"con\".\"condeferrable\" AS \"deferrable\", \"con\".\"condeferred\" AS \"deferred\" " +
                            "FROM ( " +
                            "SELECT UNNEST (\"con1\".\"conkey\") AS \"parent\", UNNEST (\"con1\".\"confkey\") AS \"child\", \"con1\".\"confrelid\", \"con1\".\"conrelid\", \"con1\".\"conname\", \"con1\".\"contype\", \"ns\".\"nspname\", " +
                            "\"cl\".\"relname\", \"con1\".\"condeferrable\", " +
                            "CASE WHEN \"con1\".\"condeferred\" THEN 'INITIALLY DEFERRED' ELSE 'INITIALLY IMMEDIATE' END as condeferred, " +
                            "CASE \"con1\".\"confdeltype\" WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END as \"confdeltype\", " +
                            "CASE \"con1\".\"confupdtype\" WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END as \"confupdtype\" " +
                            "FROM \"pg_class\" \"cl\" " +
                            "INNER JOIN \"pg_namespace\" \"ns\" ON \"cl\".\"relnamespace\" = \"ns\".\"oid\" " +
                            "INNER JOIN \"pg_constraint\" \"con1\" ON \"con1\".\"conrelid\" = \"cl\".\"oid\" " +
                            ("WHERE \"con1\".\"contype\" = 'f' AND (" + foreignKeysCondition + ") ") +
                            ") \"con\" " +
                            "INNER JOIN \"pg_attribute\" \"att\" ON \"att\".\"attrelid\" = \"con\".\"confrelid\" AND \"att\".\"attnum\" = \"con\".\"child\" " +
                            "INNER JOIN \"pg_class\" \"cl\" ON \"cl\".\"oid\" = \"con\".\"confrelid\" " +
                            "INNER JOIN \"pg_namespace\" \"ns\" ON \"cl\".\"relnamespace\" = \"ns\".\"oid\" " +
                            "INNER JOIN \"pg_attribute\" \"att2\" ON \"att2\".\"attrelid\" = \"con\".\"conrelid\" AND \"att2\".\"attnum\" = \"con\".\"parent\"";
                        return [4 /*yield*/, Promise.all([
                                this.query(tablesSql),
                                this.query(columnsSql),
                                this.query(constraintsSql),
                                this.query(indicesSql),
                                this.query(foreignKeysSql),
                            ])];
                    case 2:
                        _a = tslib_1.__read.apply(void 0, [_b.sent(), 5]), dbTables = _a[0], dbColumns = _a[1], dbConstraints = _a[2], dbIndices = _a[3], dbForeignKeys = _a[4];
                        // if tables were not found in the db, no need to proceed
                        if (!dbTables.length)
                            return [2 /*return*/, []];
                        // create tables for loaded tables
                        return [2 /*return*/, Promise.all(dbTables.map(function (dbTable) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                var table, schema, tableFullName, _a, tableUniqueConstraints, tableCheckConstraints, tableExclusionConstraints, tableForeignKeyConstraints, tableIndexConstraints;
                                var _this = this;
                                return tslib_1.__generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            table = new Table_1.Table();
                                            schema = dbTable["table_schema"] === currentSchema && !this.driver.options.schema ? undefined : dbTable["table_schema"];
                                            table.name = this.driver.buildTableName(dbTable["table_name"], schema);
                                            tableFullName = this.driver.buildTableName(dbTable["table_name"], dbTable["table_schema"]);
                                            // create columns from the loaded columns
                                            _a = table;
                                            return [4 /*yield*/, Promise.all(dbColumns
                                                    .filter(function (dbColumn) { return _this.driver.buildTableName(dbColumn["table_name"], dbColumn["table_schema"]) === tableFullName; })
                                                    .map(function (dbColumn) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                    var columnConstraints, tableColumn, type, sql, results, geometryColumnSql, results, geographyColumnSql, results, length, uniqueConstraint, isConstraintComposite;
                                                    var _this = this;
                                                    return tslib_1.__generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0:
                                                                columnConstraints = dbConstraints.filter(function (dbConstraint) {
                                                                    return _this.driver.buildTableName(dbConstraint["table_name"], dbConstraint["table_schema"]) === tableFullName && dbConstraint["column_name"] === dbColumn["column_name"];
                                                                });
                                                                tableColumn = new TableColumn_1.TableColumn();
                                                                tableColumn.name = dbColumn["column_name"];
                                                                tableColumn.type = dbColumn["regtype"].toLowerCase();
                                                                if (tableColumn.type === "numeric" || tableColumn.type === "decimal" || tableColumn.type === "float") {
                                                                    // If one of these properties was set, and another was not, Postgres sets '0' in to unspecified property
                                                                    // we set 'undefined' in to unspecified property to avoid changing column on sync
                                                                    if (dbColumn["numeric_precision"] !== null && !this.isDefaultColumnPrecision(table, tableColumn, dbColumn["numeric_precision"])) {
                                                                        tableColumn.precision = dbColumn["numeric_precision"];
                                                                    }
                                                                    else if (dbColumn["numeric_scale"] !== null && !this.isDefaultColumnScale(table, tableColumn, dbColumn["numeric_scale"])) {
                                                                        tableColumn.precision = undefined;
                                                                    }
                                                                    if (dbColumn["numeric_scale"] !== null && !this.isDefaultColumnScale(table, tableColumn, dbColumn["numeric_scale"])) {
                                                                        tableColumn.scale = dbColumn["numeric_scale"];
                                                                    }
                                                                    else if (dbColumn["numeric_precision"] !== null && !this.isDefaultColumnPrecision(table, tableColumn, dbColumn["numeric_precision"])) {
                                                                        tableColumn.scale = undefined;
                                                                    }
                                                                }
                                                                if (dbColumn["data_type"].toLowerCase() === "array") {
                                                                    tableColumn.isArray = true;
                                                                    type = tableColumn.type.replace("[]", "");
                                                                    tableColumn.type = this.connection.driver.normalizeType({ type: type });
                                                                }
                                                                if (tableColumn.type === "interval"
                                                                    || tableColumn.type === "time without time zone"
                                                                    || tableColumn.type === "time with time zone"
                                                                    || tableColumn.type === "timestamp without time zone"
                                                                    || tableColumn.type === "timestamp with time zone") {
                                                                    tableColumn.precision = !this.isDefaultColumnPrecision(table, tableColumn, dbColumn["datetime_precision"]) ? dbColumn["datetime_precision"] : undefined;
                                                                }
                                                                if (!(tableColumn.type.indexOf("enum") !== -1)) return [3 /*break*/, 2];
                                                                tableColumn.type = "enum";
                                                                sql = "SELECT \"e\".\"enumlabel\" AS \"value\" FROM \"pg_enum\" \"e\" " +
                                                                    "INNER JOIN \"pg_type\" \"t\" ON \"t\".\"oid\" = \"e\".\"enumtypid\" " +
                                                                    "INNER JOIN \"pg_namespace\" \"n\" ON \"n\".\"oid\" = \"t\".\"typnamespace\" " +
                                                                    ("WHERE \"n\".\"nspname\" = '" + dbTable["table_schema"] + "' AND \"t\".\"typname\" = '" + this.buildEnumName(table, tableColumn.name, false, true) + "'");
                                                                return [4 /*yield*/, this.query(sql)];
                                                            case 1:
                                                                results = _a.sent();
                                                                tableColumn.enum = results.map(function (result) { return result["value"]; });
                                                                _a.label = 2;
                                                            case 2:
                                                                if (!(tableColumn.type === "geometry")) return [3 /*break*/, 4];
                                                                geometryColumnSql = "SELECT * FROM (\n                        SELECT\n                          \"f_table_schema\" \"table_schema\",\n                          \"f_table_name\" \"table_name\",\n                          \"f_geometry_column\" \"column_name\",\n                          \"srid\",\n                          \"type\"\n                        FROM \"geometry_columns\"\n                      ) AS _\n                      WHERE " + tablesCondition + " AND \"column_name\" = '" + tableColumn.name + "'";
                                                                return [4 /*yield*/, this.query(geometryColumnSql)];
                                                            case 3:
                                                                results = _a.sent();
                                                                tableColumn.spatialFeatureType = results[0].type;
                                                                tableColumn.srid = results[0].srid;
                                                                _a.label = 4;
                                                            case 4:
                                                                if (!(tableColumn.type === "geography")) return [3 /*break*/, 6];
                                                                geographyColumnSql = "SELECT * FROM (\n                        SELECT\n                          \"f_table_schema\" \"table_schema\",\n                          \"f_table_name\" \"table_name\",\n                          \"f_geography_column\" \"column_name\",\n                          \"srid\",\n                          \"type\"\n                        FROM \"geography_columns\"\n                      ) AS _\n                      WHERE " + tablesCondition + " AND \"column_name\" = '" + tableColumn.name + "'";
                                                                return [4 /*yield*/, this.query(geographyColumnSql)];
                                                            case 5:
                                                                results = _a.sent();
                                                                tableColumn.spatialFeatureType = results[0].type;
                                                                tableColumn.srid = results[0].srid;
                                                                _a.label = 6;
                                                            case 6:
                                                                // check only columns that have length property
                                                                if (this.driver.withLengthColumnTypes.indexOf(tableColumn.type) !== -1 && dbColumn["character_maximum_length"]) {
                                                                    length = dbColumn["character_maximum_length"].toString();
                                                                    tableColumn.length = !this.isDefaultColumnLength(table, tableColumn, length) ? length : "";
                                                                }
                                                                tableColumn.isNullable = dbColumn["is_nullable"] === "YES";
                                                                tableColumn.isPrimary = !!columnConstraints.find(function (constraint) { return constraint["constraint_type"] === "PRIMARY"; });
                                                                uniqueConstraint = columnConstraints.find(function (constraint) { return constraint["constraint_type"] === "UNIQUE"; });
                                                                isConstraintComposite = uniqueConstraint
                                                                    ? !!dbConstraints.find(function (dbConstraint) { return dbConstraint["constraint_type"] === "UNIQUE"
                                                                        && dbConstraint["constraint_name"] === uniqueConstraint["constraint_name"]
                                                                        && dbConstraint["column_name"] !== dbColumn["column_name"]; })
                                                                    : false;
                                                                tableColumn.isUnique = !!uniqueConstraint && !isConstraintComposite;
                                                                if (dbColumn["column_default"] !== null && dbColumn["column_default"] !== undefined) {
                                                                    if (dbColumn["column_default"].replace(/"/gi, "") === "nextval('" + this.buildSequenceName(table, dbColumn["column_name"], currentSchema, true) + "'::regclass)") {
                                                                        tableColumn.isGenerated = true;
                                                                        tableColumn.generationStrategy = "increment";
                                                                    }
                                                                    else if (dbColumn["column_default"] === "gen_random_uuid()" || /^uuid_generate_v\d\(\)/.test(dbColumn["column_default"])) {
                                                                        tableColumn.isGenerated = true;
                                                                        tableColumn.generationStrategy = "uuid";
                                                                    }
                                                                    else {
                                                                        tableColumn.default = dbColumn["column_default"].replace(/::.*/, "");
                                                                    }
                                                                }
                                                                tableColumn.comment = ""; // dbColumn["COLUMN_COMMENT"];
                                                                if (dbColumn["character_set_name"])
                                                                    tableColumn.charset = dbColumn["character_set_name"];
                                                                if (dbColumn["collation_name"])
                                                                    tableColumn.collation = dbColumn["collation_name"];
                                                                return [2 /*return*/, tableColumn];
                                                        }
                                                    });
                                                }); }))];
                                        case 1:
                                            // create columns from the loaded columns
                                            _a.columns = _b.sent();
                                            tableUniqueConstraints = OrmUtils_1.OrmUtils.uniq(dbConstraints.filter(function (dbConstraint) {
                                                return _this.driver.buildTableName(dbConstraint["table_name"], dbConstraint["table_schema"]) === tableFullName
                                                    && dbConstraint["constraint_type"] === "UNIQUE";
                                            }), function (dbConstraint) { return dbConstraint["constraint_name"]; });
                                            table.uniques = tableUniqueConstraints.map(function (constraint) {
                                                var uniques = dbConstraints.filter(function (dbC) { return dbC["constraint_name"] === constraint["constraint_name"]; });
                                                return new TableUnique_1.TableUnique({
                                                    name: constraint["constraint_name"],
                                                    columnNames: uniques.map(function (u) { return u["column_name"]; })
                                                });
                                            });
                                            tableCheckConstraints = OrmUtils_1.OrmUtils.uniq(dbConstraints.filter(function (dbConstraint) {
                                                return _this.driver.buildTableName(dbConstraint["table_name"], dbConstraint["table_schema"]) === tableFullName
                                                    && dbConstraint["constraint_type"] === "CHECK";
                                            }), function (dbConstraint) { return dbConstraint["constraint_name"]; });
                                            table.checks = tableCheckConstraints.map(function (constraint) {
                                                var checks = dbConstraints.filter(function (dbC) { return dbC["constraint_name"] === constraint["constraint_name"]; });
                                                return new TableCheck_1.TableCheck({
                                                    name: constraint["constraint_name"],
                                                    columnNames: checks.map(function (c) { return c["column_name"]; }),
                                                    expression: constraint["expression"] // column names are not escaped, may cause problems
                                                });
                                            });
                                            tableExclusionConstraints = OrmUtils_1.OrmUtils.uniq(dbConstraints.filter(function (dbConstraint) {
                                                return _this.driver.buildTableName(dbConstraint["table_name"], dbConstraint["table_schema"]) === tableFullName
                                                    && dbConstraint["constraint_type"] === "EXCLUDE";
                                            }), function (dbConstraint) { return dbConstraint["constraint_name"]; });
                                            table.exclusions = tableExclusionConstraints.map(function (constraint) {
                                                return new TableExclusion_1.TableExclusion({
                                                    name: constraint["constraint_name"],
                                                    expression: constraint["expression"].substring(8) // trim EXCLUDE from start of expression
                                                });
                                            });
                                            tableForeignKeyConstraints = OrmUtils_1.OrmUtils.uniq(dbForeignKeys.filter(function (dbForeignKey) {
                                                return _this.driver.buildTableName(dbForeignKey["table_name"], dbForeignKey["table_schema"]) === tableFullName;
                                            }), function (dbForeignKey) { return dbForeignKey["constraint_name"]; });
                                            table.foreignKeys = tableForeignKeyConstraints.map(function (dbForeignKey) {
                                                var foreignKeys = dbForeignKeys.filter(function (dbFk) { return dbFk["constraint_name"] === dbForeignKey["constraint_name"]; });
                                                // if referenced table located in currently used schema, we don't need to concat schema name to table name.
                                                var schema = dbForeignKey["referenced_table_schema"] === currentSchema ? undefined : dbTable["referenced_table_schema"];
                                                var referencedTableName = _this.driver.buildTableName(dbForeignKey["referenced_table_name"], schema);
                                                return new TableForeignKey_1.TableForeignKey({
                                                    name: dbForeignKey["constraint_name"],
                                                    columnNames: foreignKeys.map(function (dbFk) { return dbFk["column_name"]; }),
                                                    referencedTableName: referencedTableName,
                                                    referencedColumnNames: foreignKeys.map(function (dbFk) { return dbFk["referenced_column_name"]; }),
                                                    onDelete: dbForeignKey["on_delete"],
                                                    onUpdate: dbForeignKey["on_update"],
                                                    deferrable: dbForeignKey["deferrable"] ? dbForeignKey["deferred"] : undefined,
                                                });
                                            });
                                            tableIndexConstraints = OrmUtils_1.OrmUtils.uniq(dbIndices.filter(function (dbIndex) {
                                                return _this.driver.buildTableName(dbIndex["table_name"], dbIndex["table_schema"]) === tableFullName;
                                            }), function (dbIndex) { return dbIndex["constraint_name"]; });
                                            table.indices = tableIndexConstraints.map(function (constraint) {
                                                var indices = dbIndices.filter(function (index) {
                                                    return index["table_schema"] === constraint["table_schema"]
                                                        && index["table_name"] === constraint["table_name"]
                                                        && index["constraint_name"] === constraint["constraint_name"];
                                                });
                                                return new TableIndex_1.TableIndex({
                                                    table: table,
                                                    name: constraint["constraint_name"],
                                                    columnNames: indices.map(function (i) { return i["column_name"]; }),
                                                    isUnique: constraint["is_unique"] === "TRUE",
                                                    where: constraint["condition"],
                                                    isSpatial: indices.every(function (i) { return _this.driver.spatialTypes.indexOf(i["type_name"]) >= 0; }),
                                                    isFulltext: false
                                                });
                                            });
                                            return [2 /*return*/, table];
                                    }
                                });
                            }); }))];
                }
            });
        });
    };
    /**
     * Builds create table sql.
     */
    PostgresQueryRunner.prototype.createTableSql = function (table, createForeignKeys) {
        var _this = this;
        var columnDefinitions = table.columns.map(function (column) { return _this.buildCreateColumnSql(table, column); }).join(", ");
        var sql = "CREATE TABLE " + this.escapePath(table) + " (" + columnDefinitions;
        table.columns
            .filter(function (column) { return column.isUnique; })
            .forEach(function (column) {
            var isUniqueExist = table.uniques.some(function (unique) { return unique.columnNames.length === 1 && unique.columnNames[0] === column.name; });
            if (!isUniqueExist)
                table.uniques.push(new TableUnique_1.TableUnique({
                    name: _this.connection.namingStrategy.uniqueConstraintName(table.name, [column.name]),
                    columnNames: [column.name]
                }));
        });
        if (table.uniques.length > 0) {
            var uniquesSql = table.uniques.map(function (unique) {
                var uniqueName = unique.name ? unique.name : _this.connection.namingStrategy.uniqueConstraintName(table.name, unique.columnNames);
                var columnNames = unique.columnNames.map(function (columnName) { return "\"" + columnName + "\""; }).join(", ");
                return "CONSTRAINT \"" + uniqueName + "\" UNIQUE (" + columnNames + ")";
            }).join(", ");
            sql += ", " + uniquesSql;
        }
        if (table.checks.length > 0) {
            var checksSql = table.checks.map(function (check) {
                var checkName = check.name ? check.name : _this.connection.namingStrategy.checkConstraintName(table.name, check.expression);
                return "CONSTRAINT \"" + checkName + "\" CHECK (" + check.expression + ")";
            }).join(", ");
            sql += ", " + checksSql;
        }
        if (table.exclusions.length > 0) {
            var exclusionsSql = table.exclusions.map(function (exclusion) {
                var exclusionName = exclusion.name ? exclusion.name : _this.connection.namingStrategy.exclusionConstraintName(table.name, exclusion.expression);
                return "CONSTRAINT \"" + exclusionName + "\" EXCLUDE " + exclusion.expression;
            }).join(", ");
            sql += ", " + exclusionsSql;
        }
        if (table.foreignKeys.length > 0 && createForeignKeys) {
            var foreignKeysSql = table.foreignKeys.map(function (fk) {
                var columnNames = fk.columnNames.map(function (columnName) { return "\"" + columnName + "\""; }).join(", ");
                if (!fk.name)
                    fk.name = _this.connection.namingStrategy.foreignKeyName(table.name, fk.columnNames);
                var referencedColumnNames = fk.referencedColumnNames.map(function (columnName) { return "\"" + columnName + "\""; }).join(", ");
                var constraint = "CONSTRAINT \"" + fk.name + "\" FOREIGN KEY (" + columnNames + ") REFERENCES " + _this.escapePath(fk.referencedTableName) + " (" + referencedColumnNames + ")";
                if (fk.onDelete)
                    constraint += " ON DELETE " + fk.onDelete;
                if (fk.onUpdate)
                    constraint += " ON UPDATE " + fk.onUpdate;
                if (fk.deferrable)
                    constraint += " DEFERRABLE " + fk.deferrable;
                return constraint;
            }).join(", ");
            sql += ", " + foreignKeysSql;
        }
        var primaryColumns = table.columns.filter(function (column) { return column.isPrimary; });
        if (primaryColumns.length > 0) {
            var primaryKeyName = this.connection.namingStrategy.primaryKeyName(table.name, primaryColumns.map(function (column) { return column.name; }));
            var columnNames = primaryColumns.map(function (column) { return "\"" + column.name + "\""; }).join(", ");
            sql += ", CONSTRAINT \"" + primaryKeyName + "\" PRIMARY KEY (" + columnNames + ")";
        }
        sql += ")";
        return new Query_1.Query(sql);
    };
    /**
     * Builds drop table sql.
     */
    PostgresQueryRunner.prototype.dropTableSql = function (tableOrPath) {
        return new Query_1.Query("DROP TABLE " + this.escapePath(tableOrPath));
    };
    PostgresQueryRunner.prototype.createViewSql = function (view) {
        if (typeof view.expression === "string") {
            return new Query_1.Query("CREATE VIEW " + this.escapePath(view) + " AS " + view.expression);
        }
        else {
            return new Query_1.Query("CREATE VIEW " + this.escapePath(view) + " AS " + view.expression(this.connection).getQuery());
        }
    };
    PostgresQueryRunner.prototype.insertViewDefinitionSql = function (view) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var currentSchemaQuery, currentSchema, splittedName, schema, name, expression, _a, query, parameters;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.query("SELECT * FROM current_schema()")];
                    case 1:
                        currentSchemaQuery = _b.sent();
                        currentSchema = currentSchemaQuery[0]["current_schema"];
                        splittedName = view.name.split(".");
                        schema = this.driver.options.schema || currentSchema;
                        name = view.name;
                        if (splittedName.length === 2) {
                            schema = splittedName[0];
                            name = splittedName[1];
                        }
                        expression = typeof view.expression === "string" ? view.expression.trim() : view.expression(this.connection).getQuery();
                        _a = tslib_1.__read(this.connection.createQueryBuilder()
                            .insert()
                            .into(this.getTypeormMetadataTableName())
                            .values({ type: "VIEW", schema: schema, name: name, value: expression })
                            .getQueryAndParameters(), 2), query = _a[0], parameters = _a[1];
                        return [2 /*return*/, new Query_1.Query(query, parameters)];
                }
            });
        });
    };
    /**
     * Builds drop view sql.
     */
    PostgresQueryRunner.prototype.dropViewSql = function (viewOrPath) {
        return new Query_1.Query("DROP VIEW " + this.escapePath(viewOrPath));
    };
    /**
     * Builds remove view sql.
     */
    PostgresQueryRunner.prototype.deleteViewDefinitionSql = function (viewOrPath) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var currentSchemaQuery, currentSchema, viewName, splittedName, schema, name, qb, _a, query, parameters;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.query("SELECT * FROM current_schema()")];
                    case 1:
                        currentSchemaQuery = _b.sent();
                        currentSchema = currentSchemaQuery[0]["current_schema"];
                        viewName = viewOrPath instanceof View_1.View ? viewOrPath.name : viewOrPath;
                        splittedName = viewName.split(".");
                        schema = this.driver.options.schema || currentSchema;
                        name = viewName;
                        if (splittedName.length === 2) {
                            schema = splittedName[0];
                            name = splittedName[1];
                        }
                        qb = this.connection.createQueryBuilder();
                        _a = tslib_1.__read(qb.delete()
                            .from(this.getTypeormMetadataTableName())
                            .where(qb.escape("type") + " = 'VIEW'")
                            .andWhere(qb.escape("schema") + " = :schema", { schema: schema })
                            .andWhere(qb.escape("name") + " = :name", { name: name })
                            .getQueryAndParameters(), 2), query = _a[0], parameters = _a[1];
                        return [2 /*return*/, new Query_1.Query(query, parameters)];
                }
            });
        });
    };
    /**
     * Extracts schema name from given Table object or table name string.
     */
    PostgresQueryRunner.prototype.extractSchema = function (target) {
        var tableName = target instanceof Table_1.Table ? target.name : target;
        return tableName.indexOf(".") === -1 ? this.driver.options.schema : tableName.split(".")[0];
    };
    /**
     * Drops ENUM type from given schemas.
     */
    PostgresQueryRunner.prototype.dropEnumTypes = function (schemaNames) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var selectDropsQuery, dropQueries;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        selectDropsQuery = "SELECT 'DROP TYPE IF EXISTS \"' || n.nspname || '\".\"' || t.typname || '\" CASCADE;' as \"query\" FROM \"pg_type\" \"t\" " +
                            "INNER JOIN \"pg_enum\" \"e\" ON \"e\".\"enumtypid\" = \"t\".\"oid\" " +
                            "INNER JOIN \"pg_namespace\" \"n\" ON \"n\".\"oid\" = \"t\".\"typnamespace\" " +
                            ("WHERE \"n\".\"nspname\" IN (" + schemaNames + ") GROUP BY \"n\".\"nspname\", \"t\".\"typname\"");
                        return [4 /*yield*/, this.query(selectDropsQuery)];
                    case 1:
                        dropQueries = _a.sent();
                        return [4 /*yield*/, Promise.all(dropQueries.map(function (q) { return _this.query(q["query"]); }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Checks if enum with the given name exist in the database.
     */
    PostgresQueryRunner.prototype.hasEnumType = function (table, column) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var schema, enumName, sql, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        schema = this.parseTableName(table).schema;
                        enumName = this.buildEnumName(table, column, false, true);
                        sql = "SELECT \"n\".\"nspname\", \"t\".\"typname\" FROM \"pg_type\" \"t\" " +
                            "INNER JOIN \"pg_namespace\" \"n\" ON \"n\".\"oid\" = \"t\".\"typnamespace\" " +
                            ("WHERE \"n\".\"nspname\" = " + schema + " AND \"t\".\"typname\" = '" + enumName + "'");
                        return [4 /*yield*/, this.query(sql)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length ? true : false];
                }
            });
        });
    };
    /**
     * Builds create ENUM type sql.
     */
    PostgresQueryRunner.prototype.createEnumTypeSql = function (table, column, enumName) {
        if (!enumName)
            enumName = this.buildEnumName(table, column);
        var enumValues = column.enum.map(function (value) { return "'" + value.replace("'", "''") + "'"; }).join(", ");
        return new Query_1.Query("CREATE TYPE " + enumName + " AS ENUM(" + enumValues + ")");
    };
    /**
     * Builds create ENUM type sql.
     */
    PostgresQueryRunner.prototype.dropEnumTypeSql = function (table, column, enumName) {
        if (!enumName)
            enumName = this.buildEnumName(table, column);
        return new Query_1.Query("DROP TYPE " + enumName);
    };
    /**
     * Builds create index sql.
     */
    PostgresQueryRunner.prototype.createIndexSql = function (table, index) {
        var columns = index.columnNames.map(function (columnName) { return "\"" + columnName + "\""; }).join(", ");
        return new Query_1.Query("CREATE " + (index.isUnique ? "UNIQUE " : "") + "INDEX \"" + index.name + "\" ON " + this.escapePath(table) + " " + (index.isSpatial ? "USING GiST " : "") + "(" + columns + ") " + (index.where ? "WHERE " + index.where : ""));
    };
    /**
     * Builds drop index sql.
     */
    PostgresQueryRunner.prototype.dropIndexSql = function (table, indexOrName) {
        var indexName = indexOrName instanceof TableIndex_1.TableIndex ? indexOrName.name : indexOrName;
        var schema = this.extractSchema(table);
        return schema ? new Query_1.Query("DROP INDEX \"" + schema + "\".\"" + indexName + "\"") : new Query_1.Query("DROP INDEX \"" + indexName + "\"");
    };
    /**
     * Builds create primary key sql.
     */
    PostgresQueryRunner.prototype.createPrimaryKeySql = function (table, columnNames) {
        var primaryKeyName = this.connection.namingStrategy.primaryKeyName(table.name, columnNames);
        var columnNamesString = columnNames.map(function (columnName) { return "\"" + columnName + "\""; }).join(", ");
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + primaryKeyName + "\" PRIMARY KEY (" + columnNamesString + ")");
    };
    /**
     * Builds drop primary key sql.
     */
    PostgresQueryRunner.prototype.dropPrimaryKeySql = function (table) {
        var columnNames = table.primaryColumns.map(function (column) { return column.name; });
        var primaryKeyName = this.connection.namingStrategy.primaryKeyName(table.name, columnNames);
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + primaryKeyName + "\"");
    };
    /**
     * Builds create unique constraint sql.
     */
    PostgresQueryRunner.prototype.createUniqueConstraintSql = function (table, uniqueConstraint) {
        var columnNames = uniqueConstraint.columnNames.map(function (column) { return "\"" + column + "\""; }).join(", ");
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + uniqueConstraint.name + "\" UNIQUE (" + columnNames + ")");
    };
    /**
     * Builds drop unique constraint sql.
     */
    PostgresQueryRunner.prototype.dropUniqueConstraintSql = function (table, uniqueOrName) {
        var uniqueName = uniqueOrName instanceof TableUnique_1.TableUnique ? uniqueOrName.name : uniqueOrName;
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + uniqueName + "\"");
    };
    /**
     * Builds create check constraint sql.
     */
    PostgresQueryRunner.prototype.createCheckConstraintSql = function (table, checkConstraint) {
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + checkConstraint.name + "\" CHECK (" + checkConstraint.expression + ")");
    };
    /**
     * Builds drop check constraint sql.
     */
    PostgresQueryRunner.prototype.dropCheckConstraintSql = function (table, checkOrName) {
        var checkName = checkOrName instanceof TableCheck_1.TableCheck ? checkOrName.name : checkOrName;
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + checkName + "\"");
    };
    /**
     * Builds create exclusion constraint sql.
     */
    PostgresQueryRunner.prototype.createExclusionConstraintSql = function (table, exclusionConstraint) {
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + exclusionConstraint.name + "\" EXCLUDE " + exclusionConstraint.expression);
    };
    /**
     * Builds drop exclusion constraint sql.
     */
    PostgresQueryRunner.prototype.dropExclusionConstraintSql = function (table, exclusionOrName) {
        var exclusionName = exclusionOrName instanceof TableExclusion_1.TableExclusion ? exclusionOrName.name : exclusionOrName;
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + exclusionName + "\"");
    };
    /**
     * Builds create foreign key sql.
     */
    PostgresQueryRunner.prototype.createForeignKeySql = function (table, foreignKey) {
        var columnNames = foreignKey.columnNames.map(function (column) { return "\"" + column + "\""; }).join(", ");
        var referencedColumnNames = foreignKey.referencedColumnNames.map(function (column) { return "\"" + column + "\""; }).join(",");
        var sql = "ALTER TABLE " + this.escapePath(table) + " ADD CONSTRAINT \"" + foreignKey.name + "\" FOREIGN KEY (" + columnNames + ") " +
            ("REFERENCES " + this.escapePath(foreignKey.referencedTableName) + "(" + referencedColumnNames + ")");
        if (foreignKey.onDelete)
            sql += " ON DELETE " + foreignKey.onDelete;
        if (foreignKey.onUpdate)
            sql += " ON UPDATE " + foreignKey.onUpdate;
        if (foreignKey.deferrable)
            sql += " DEFERRABLE " + foreignKey.deferrable;
        return new Query_1.Query(sql);
    };
    /**
     * Builds drop foreign key sql.
     */
    PostgresQueryRunner.prototype.dropForeignKeySql = function (table, foreignKeyOrName) {
        var foreignKeyName = foreignKeyOrName instanceof TableForeignKey_1.TableForeignKey ? foreignKeyOrName.name : foreignKeyOrName;
        return new Query_1.Query("ALTER TABLE " + this.escapePath(table) + " DROP CONSTRAINT \"" + foreignKeyName + "\"");
    };
    /**
     * Builds sequence name from given table and column.
     */
    PostgresQueryRunner.prototype.buildSequenceName = function (table, columnOrName, currentSchema, disableEscape, skipSchema) {
        var columnName = columnOrName instanceof TableColumn_1.TableColumn ? columnOrName.name : columnOrName;
        var schema = undefined;
        var tableName = undefined;
        if (table.name.indexOf(".") === -1) {
            tableName = table.name;
        }
        else {
            schema = table.name.split(".")[0];
            tableName = table.name.split(".")[1];
        }
        if (schema && schema !== currentSchema && !skipSchema) {
            return disableEscape ? schema + "." + tableName + "_" + columnName + "_seq" : "\"" + schema + "\".\"" + tableName + "_" + columnName + "_seq\"";
        }
        else {
            return disableEscape ? tableName + "_" + columnName + "_seq" : "\"" + tableName + "_" + columnName + "_seq\"";
        }
    };
    /**
     * Builds ENUM type name from given table and column.
     */
    PostgresQueryRunner.prototype.buildEnumName = function (table, columnOrName, withSchema, disableEscape, toOld) {
        if (withSchema === void 0) { withSchema = true; }
        var columnName = columnOrName instanceof TableColumn_1.TableColumn ? columnOrName.name : columnOrName;
        var schema = table.name.indexOf(".") === -1 ? this.driver.options.schema : table.name.split(".")[0];
        var tableName = table.name.indexOf(".") === -1 ? table.name : table.name.split(".")[1];
        var enumName = schema && withSchema ? schema + "." + tableName + "_" + columnName.toLowerCase() + "_enum" : tableName + "_" + columnName.toLowerCase() + "_enum";
        if (toOld)
            enumName = enumName + "_old";
        return enumName.split(".").map(function (i) {
            return disableEscape ? i : "\"" + i + "\"";
        }).join(".");
    };
    PostgresQueryRunner.prototype.getEnumTypeName = function (table, column) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var currentSchemaQuery, currentSchema, _a, schema, name, result;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.query("SELECT * FROM current_schema()")];
                    case 1:
                        currentSchemaQuery = _b.sent();
                        currentSchema = currentSchemaQuery[0]["current_schema"];
                        _a = tslib_1.__read(table.name.split("."), 2), schema = _a[0], name = _a[1];
                        if (!name) {
                            name = schema;
                            schema = this.driver.options.schema || currentSchema;
                        }
                        return [4 /*yield*/, this.query("SELECT \"udt_schema\", \"udt_name\" " +
                                ("FROM \"information_schema\".\"columns\" WHERE \"table_schema\" = '" + schema + "' AND \"table_name\" = '" + name + "' AND \"column_name\"='" + column.name + "'"))];
                    case 2:
                        result = _b.sent();
                        return [2 /*return*/, {
                                enumTypeSchema: result[0]["udt_schema"],
                                enumTypeName: result[0]["udt_name"]
                            }];
                }
            });
        });
    };
    /**
     * Escapes given table or view path.
     */
    PostgresQueryRunner.prototype.escapePath = function (target, disableEscape) {
        var tableName = target instanceof Table_1.Table || target instanceof View_1.View ? target.name : target;
        tableName = tableName.indexOf(".") === -1 && this.driver.options.schema ? this.driver.options.schema + "." + tableName : tableName;
        return tableName.split(".").map(function (i) {
            return disableEscape ? i : "\"" + i + "\"";
        }).join(".");
    };
    /**
     * Returns object with table schema and table name.
     */
    PostgresQueryRunner.prototype.parseTableName = function (target) {
        var tableName = target instanceof Table_1.Table ? target.name : target;
        if (tableName.indexOf(".") === -1) {
            return {
                schema: this.driver.options.schema ? "'" + this.driver.options.schema + "'" : "current_schema()",
                tableName: "'" + tableName + "'"
            };
        }
        else {
            return {
                schema: "'" + tableName.split(".")[0] + "'",
                tableName: "'" + tableName.split(".")[1] + "'"
            };
        }
    };
    /**
     * Builds a query for create column.
     */
    PostgresQueryRunner.prototype.buildCreateColumnSql = function (table, column) {
        var c = "\"" + column.name + "\"";
        if (column.isGenerated === true && column.generationStrategy !== "uuid") {
            if (column.type === "integer" || column.type === "int" || column.type === "int4")
                c += " SERIAL";
            if (column.type === "smallint" || column.type === "int2")
                c += " SMALLSERIAL";
            if (column.type === "bigint" || column.type === "int8")
                c += " BIGSERIAL";
        }
        if (column.type === "enum" || column.type === "simple-enum") {
            c += " " + this.buildEnumName(table, column);
            if (column.isArray)
                c += " array";
        }
        else if (!column.isGenerated || column.type === "uuid") {
            c += " " + this.connection.driver.createFullType(column);
        }
        if (column.charset)
            c += " CHARACTER SET \"" + column.charset + "\"";
        if (column.collation)
            c += " COLLATE \"" + column.collation + "\"";
        if (column.isNullable !== true)
            c += " NOT NULL";
        if (column.default !== undefined && column.default !== null)
            c += " DEFAULT " + column.default;
        if (column.isGenerated && column.generationStrategy === "uuid" && !column.default)
            c += " DEFAULT " + this.driver.uuidGenerator;
        return c;
    };
    return PostgresQueryRunner;
}(BaseQueryRunner_1.BaseQueryRunner));
exports.PostgresQueryRunner = PostgresQueryRunner;

//# sourceMappingURL=PostgresQueryRunner.js.map
