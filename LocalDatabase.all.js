/**
 * The schema for a column using LocalDatabase.
 */
 class ColumnSchema {
    /**
     * @typedef ColumnSchemaOptions
     * @property {Boolean} unique If true, the column will not allow duplicate values for a single key.
     * @property {Boolean} multiEntry If true, the column will add an entry in the entry for each array element when the keyPath resolves to an array. If false, it will add one single entry containing the array.
     * @property {String} locale A string containing a specific locale code, e.g. en-US, or pl
     */

    /**
     * The options you want to initialise this column with.
     * @type {ColumnSchemaOptions}
     */
    options = {
        unique: false,
        multiEntry: false,
        locale: null
    };
    /**
     * The name of the column.
     * @type {String}
     */
    name = "";

    /**
     * Generates a column blueprint for use in the TableSchema.
     * @param {String} name The name of the column.
     * @param {ColumnSchemaOptions} [options] The options you want to initialise this column with.
     */
    constructor(name, options = this.options) {
        this.name = name;
        this.options = options;
    }
}

/**
 * The schema for a database using LocalDatabase.
 */
 class DatabaseSchema {
    /**
     * The name of your database.
     * @type {String}
     */
    name = "";

    /**
     * The tables of your database.
     */
    tables = [];

    /**
     * Generates a database blueprint for use in LocalDatabase.
     * @param {String} name 
     * @param {Array.<TableSchema>} [tables] An array of the tables you want to have in this database.
     */
    constructor(name, tables = []) {
        this.name = name;
        this.tables = tables;
    }
}

/**
 * The schema for a table using LocalDatabase.
 */
 class TableSchema {
    /**
     * The name of the table.
     * @type {String}
     */
    name = ""
    /**
     * The primary column. This must not have any duplicates!
     * @type {ColumnSchema}
     */
    keyColumn = null;
    /**
     * The columns that are not the keyColumn that reside in this table.
     * @type {Array.<ColumnSchema>}
     */
    otherColumns = [];
    /**
     * If true, the table has a key generator.
     * @type {Boolean}
     */
    autoIncrement = false;

    /**
     * Generates a table blueprint for use in DatabaseSchema.
     * @param {String} name
     * @param {ColumnSchema} keyColumn The primary column for this table. This column must not have any duplicates!
     * @param {Array.<ColumnSchema>} [otherColumns] An array of all of the other columns you want to have in this table.
     * @param {Boolean} [autoIncrement] If true, the table has a key generator.
     */
    constructor(name, keyColumn, otherColumns = [], autoIncrement = false) {
        if(!name) throw Error("Error in TableSchema. Attempting to generate a table without providing a table name.");
        if(!keyColumn) throw Error("Error in TableSchema. Attempting to generate a table without providing a primary column.");
        if(otherColumns.includes(keyColumn) || new Set(otherColumns).size !== otherColumns.length) console.warn("Warning in TableSchema. You are trying to generate a table using duplicate columns. Make sure you have not included your chosen keyColumn in the \"otherColumns\" parameter.");
        this.name = name
        this.keyColumn = keyColumn;
        this.otherColumns = otherColumns;
        this.autoIncrement = autoIncrement;
    }
    
}

/**
 * A local database to handle local data storage such as the information about `items`.
 */
 class LocalDatabase {

    /**
     * Instance of IndexedDB.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase
     * @type {IDBDatabase}
     */
    static instance = undefined;
    /**
     * The version of your database. Upgrade this each time you want to add new features.
     * 
     * The version of the database determines the database schema — the object stores in the database and their structure.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/version
     */
    static version = 1;

    /**
     * The name of the tables used by this database.
     * @type {String}
     */
    static tableNames = [];

    /**
     * Initialise the LocalDatabase system.
     * @param {DatabaseSchema} schema The database schema. Something like: {cats: [id, age, name]}
     * @async Make sure to await this method's completion before using any of the LocalDatabase database methods (select, add).
     */
    static init(schema) {
        if (!window.indexedDB) {
            throw Error("Your browser doesn't support a stable version of IndexedDB. As such, this app cannot run properly.");
        }

        // Attempt to access the IndexedDB API
        window.indexedDB.deleteDatabase(schema.name);
        const opening = window.indexedDB.open(schema.name, 1);

        return new Promise((success, reject) => {
            opening.onerror = event => {
                console.error("Error: LocalDatabase opening error", event);
                reject(new Error(`Error in opening IndexedDb. Make sure your browser supports IndexedDb and that you accept the request to initialise a local database. Also make sure you are running the right version!\n\nIndexedDb error:\n${event.target.error.name}: ${event.target.error.message}`));
            }
    
    
            opening.onblocked = event => {
                console.error("Error: LocalDatabase blocked", event);
                throw Error("Error in opening IndexedDb. There can only be one instance of this game running at a time. Please close that game before continuing.");
            }
    
    
            opening.onupgradeneeded = event => {
                LocalDatabase.instance = event.target.result;
                LocalDatabase.upgrade(schema);
            }
    
            opening.onsuccess = event => {
                LocalDatabase.instance = event.target.result;
                console.log("LocalDatabase initialised!");
                success(event);

                LocalDatabase.instance.onerror = event => {
                    LocalDatabase.error(event)
                }
                LocalDatabase.instance.onversionchange = event => {
                    LocalDatabase.instance.close();
                    console.warn("A new version of this page is ready. Please reload or close this tab!");
                    // @todo do something to make the user close this tab.
                }
            }
        })
    }

    /**
     * Upgrades the database using the provided schema.
     * @param {*} schema 
     */
    static upgrade(schema) {
        /**
         * @important Make sure you update the `LocalDatabase.version` 
         */

        // Set the tables (object stores)
        for(const table of schema.tables) {
            // Add tables to the definition
            this.tableNames.push(table.name);
            const tableStore = LocalDatabase.instance.createObjectStore(table.name, { keyPath: table.keyColumn.name, autoIncrement: table.autoIncrement });
            // Set the columns (indexes)
            for(const column of table.otherColumns) {
                tableStore.createIndex(column.name, column.name, column.options);
            }
        }
    }

    /**
     * Inserts (or updates on collision) multiple items to a table.
     * @param {String} table 
     * @param {Array.<Object>} objects 
     * @param {AddOptions} options 
     * @returns {Promise} Promise that resolves when all inserts have completed successfully.
     * @async
     */
    static multiAdd(table, objects, options = { upsert: true }) {
        return Promise.all(objects.map(object => LocalDatabase.add(table, object, options)));
    }

    /**
     * @typedef AddOptions
     * @property {Boolean} upsert https://en.wikipedia.org/wiki/Merge_(SQL)#Synonymous
     */

    /**
     * Inserts (or updates on collision) an item to a table.
     * @param {String} table
     * @param {Object} object 
     * @param {AddOptions} options 
     * @returns {Promise}
     * @async
     */
    static add(table, object, options = { upsert: true }) {
        if(!LocalDatabase.instance) throw Error("Error in LocalDatabase.add: The database has not yet been initialised! Please make sure you run `await LocalDatabase.init()` before using this.");
        if(!table) throw Error("Error in LocalDatabase.add: No store defined.");
        if(!LocalDatabase.tableNames.includes(table)) throw Error(`Error in LocalDatabase.select: The specified table (${table}) was not found in the schema used to initialise the database.`);
        return new Promise((success, reject) => {
            const txn = LocalDatabase.instance.transaction(table, "readwrite");
            const store = txn.objectStore(table);

            if(options.upsert)
                store.put(object);
            else
                store.add(object);
            
            txn.oncomplete = event => {
                success(event);
            }

            txn.onerror = event => {
                console.error(`Error in LocalDatabase.add for store (${table}). Object, Options, Event:`, object, options, event);
                reject(new Error(`Error in LocalDatabase.add for store (${table}). Check console.`));
            }
        })
    }

    /**
     * Queries the store to select all entries matching the query.
     * 
     * **Selects are structured as:**
     * 
     * `{ columnName: desiredValue }` 
     * 
     * or 
     * 
     * `{ columnName: { $lt: desiredMax, $gt: desiredMin, $ne: notEqualTo } }`
     * 
     * @note All column queries are 1 layer deep. Querying columns that contain objects is not currently possible.
     * 
     * @note Selectors are $lt (Less Than), $gt (Greater Than), and $ne (Not Equal To)
     * 
     * @param {String} table 
     * @param {*} query 
     */
    static select(table, query) {
        if(!LocalDatabase.instance) throw Error("Error in LocalDatabase.select: The database has not yet been initialised! Please make sure you run `await LocalDatabase.init()` before using this.");
        if(!table) throw Error("Error in LocalDatabase.select: No table defined.");
        if(!LocalDatabase.tableNames.includes(table)) throw Error(`Error in LocalDatabase.select: The specified table (${table}) was not found in the schema used to initialise the database.`);
        return new Promise((success, reject) => {
            // Destructure query into $lt, $gt, $ne
            // The below arrays will be populated with a series of arrays like: [columnName, columnEntry]
            const boundQueries = [];
            const ltQueries = [];
            const gtQueries = [];
            const neQueries = [];
            const basicQueries = [];
            for(const [columnName, columnEntry] of Object.entries(query)) {
                // Basic query for exact matches
                if(LocalDatabase._isPrimitive(columnEntry) || columnEntry === null) {
                    basicQueries.push([columnName, columnEntry]);
                    continue;
                }

                // Within a range
                if(columnEntry.$lt !== undefined && columnEntry.$gt !== undefined)
                    boundQueries.push([columnName, IDBKeyRange.bound(columnEntry.$gt, columnEntry.$lt)]);

                // Less than, no greater than
                if(columnEntry.$lt !== undefined && !(columnEntry.$gt !== undefined))
                    ltQueries.push([columnName, IDBKeyRange.upperBound(columnEntry.$lt)]);

                // Greater than
                if(!(columnEntry.$lt !== undefined) && columnEntry.$gt !== undefined)
                    gtQueries.push([columnName, IDBKeyRange.lowerBound(columnEntry.$gt)]);

                // Not equal to
                if(columnEntry.$ne !== undefined)
                    neQueries.push([columnName, columnEntry.$ne]);
                    
            }

            /**
             * Gets an array of promises from a set of queries to be actioned on.
             * @param {Array} queryArray 
             * @returns {Array}
             */
            const getPromisesFromQueryArray = queryArray => {
                const txn = LocalDatabase.instance.transaction(table, "readonly");
                const store = txn.objectStore(table);
                const allPromises = [];
                for(const query of queryArray) {
                    allPromises.push(new Promise(complete => {
                        const index = LocalDatabase._getIndex(store, query[0], "Error in LocalDatabase.select"); // [0] is the columnName
                        const action = index.getAll(query[1]); // [1] is the value we want
                        action.onsuccess = event => complete(event.target.result)
                        action.onerror = event => {
                            console.error(`Error in LocalDatabase.select for store (${table}). Query, Event:`, query, event);
                            reject(new Error(`Error in LocalDatabase.select for store (${table}). Check console.`));
                        }
                    }))
                }
                return allPromises;
            }

            // Perform additive queries
            const additivePromises = getPromisesFromQueryArray([...boundQueries, ...basicQueries, ...ltQueries, ...gtQueries]);
            // Perform subtractive queries
            const subtractivePromises = getPromisesFromQueryArray(neQueries);

            // Await all additive promises' completion
            Promise.all(additivePromises).then(additiveResult => {
                // If there is just 1 result, and there is no $ne queries return that.
                if(neQueries.length === 0 && additiveResult.length <= 1) {
                    success(additiveResult[0]);
                    return;
                }

                /**
                 * Uses LocalDatabase._consolidate to consolidate the arrays nested within the array of arrays provided.
                 * @param {Array.<Array>} arrayOfArrays
                 * @returns {Array.<Array>} This result will be the consolidated and stringified version of the passed array.
                 */
                const intersectAndStringifyArrayOfArrays = arrayOfArrays => {
                    // NOTE: Because the results are objects, we have to turn them into primitives for comparison
                    let isFirst = true;
                    return arrayOfArrays.reduce((accumulation, current) => {
                        // Skip the first element (premature optimisation maybe)
                        if(isFirst) {
                            isFirst = false;
                            return accumulation;
                        }
                        // Convert all entries of the current array to JSON.
                        return LocalDatabase._intersect(accumulation, LocalDatabase._stringifyArrayElements(current));
                    }, LocalDatabase._stringifyArrayElements(arrayOfArrays[0])); // We need the initial value to be the first entry otherwise we will always get nothing because the intersection of nothing with something is nothing.
                }

                // Merge results
                const stringifiedAdditiveResults = intersectAndStringifyArrayOfArrays(additiveResult);

                // If we do not need to remove any results using subtractive queries, return.
                if(subtractivePromises.length === 0) {
                    success(LocalDatabase._parseArrayElements(stringifiedAdditiveResults));
                    return;
                }

                // Filter out subtractive queries
                Promise.all(subtractivePromises).then(subtractiveResult => {
                    const stringifiedSubtractiveResults = intersectAndStringifyArrayOfArrays(subtractiveResult);
                    const stringifiedMergedResults = LocalDatabase._difference(stringifiedAdditiveResults, stringifiedSubtractiveResults);
                    success(LocalDatabase._parseArrayElements(stringifiedMergedResults));
                    return;
                });
                
            })
        })
    }

    /**
     * Gets an index from an object store.
     * @param {IDBObjectStore} store 
     * @param {String} name 
     * @param {String} errorMessagePrepend
     * @returns {IDBIndex}
     */
    static _getIndex(store, name, errorMessagePrepend) {
        try {
            return store.index(name);
        } catch (error) {
            throw Error(`${errorMessagePrepend}\nErrored while trying to find column (${name}) in table (${store.name}). Make sure your specified column exists and is available!\n\nIndexedDb Error:\n${error.message}`);
        }
    }

    /**
     * Merges an array with a base array to create a new array from entries that only appear in both arrays.
     * @param {Array} baseArray 
     * @param {Array} arrayToMerge 
     */
    static _intersect(baseArray, arrayToMerge) {
        return arrayToMerge.filter(entry => baseArray.includes(entry));
    }

    /**
     * Asymmetrically gets the difference of the two passed arrays.
     * @example LocalDatabase._difference(['a', 'b', 'c', 'd'], ['a', 'b']) // Result: ["c", "d"]
     * @example LocalDatabase._difference(['a', 'b'], ['a', 'b', 'c', 'd']) // Result: []
     * @param {Array} baseArray 
     * @param {Array} arrayToMerge 
     */
    static _difference(baseArray, arrayToCompare) {
        return baseArray.filter(entry => !arrayToCompare.includes(entry));
    }

    /**
     * Returns true or false depending on whether or not the given variable is a primitive.
     * @param {*} variable
     * @return {Boolean}
     */
    static _isPrimitive(variable) {
        return["number", "string", "boolean", "bigint", "symbol"].includes(typeof variable);
    }

    /**
     * Stringifies all of an array's elements using `JSON.stringify`.
     * @example [{name:"bob"}] becomes ['{"name":"bob"}']
     * @param {Array} array
     * @returns {Array}
     */
    static _stringifyArrayElements(array) {
        return array.map(element => JSON.stringify(element))
    }

    /**
     * De-stringifies all of an array's elements using `JSON.stringify.
     * @example ['{"name":"bob"}'] becomes [{name:"bob"}]
     * @param {Array} array 
     * @returns {Array}
     */
    static _parseArrayElements(array) {
        return array.map(element => JSON.parse(element));
    }

    /**
     * Handle database errors. Probably should rework this to show more information.
     * @param {*} event 
     */
    static error(event) {
        throw Error(`Error with LocalDatabase. Error: ${event.target.errorCode}`);
    }

    /**
     * The schema for a column using LocalDatabase.
     * @type {ColumnSchema}
     */
    static Column = ColumnSchema;
    /**
     * The schema for a table using LocalDatabase.
     * @type {TableSchema}
     */
    static Table = TableSchema;
    /**
     * The schema for a database using LocalDatabase.
     * @type {DatabaseSchema}
     */
    static Database = DatabaseSchema;

}