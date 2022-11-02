import TableSchema from './TableSchema';
import ColumnSchema from './ColumnSchema';
import DatabaseSchema from './DatabaseSchema';

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
     * The schema used to initialise this database.
     * @type {DatabaseSchema}
     */
    static schema = null;

    /**
     * Initialise the LocalDatabase system.
     * @param {DatabaseSchema} schema The database schema. Something like: {cats: [id, age, name]}
     * @async Make sure to await this method's completion before using any of the LocalDatabase database methods (select, add).
     */
    static init(schema) {
        if (!window.indexedDB) {
            throw Error("Your browser doesn't support a stable version of IndexedDB. As such, this app cannot run properly.");
        }

        LocalDatabase.schema = schema;

        // Attempt to access the IndexedDB API
        window.indexedDB.deleteDatabase(schema.name);
        const opening = window.indexedDB.open(schema.name, LocalDatabase.version);

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

        for(const table of schema.tables) {
            // Set the tables (object stores)
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
        if(!LocalDatabase.schema.tableNames.includes(table)) throw Error(`Error in LocalDatabase.select: The specified table (${table}) was not found in the schema used to initialise the database.`);
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
     * @note Range selectors are $lt (Less Than), $lte (Less Than or Equal To), $gt (Greater Than), $gte (Greater Than or Equal To), and $ne (Not Equal To)
     * 
     * @param {String} table 
     * @param {*} query 
     */
    static select(table, query) {
        if(!LocalDatabase.instance) throw Error("Error in LocalDatabase.select: The database has not yet been initialised! Please make sure you run `await LocalDatabase.init()` before using this.");
        if(!table) throw Error("Error in LocalDatabase.select: No table defined.");
        if(!LocalDatabase.schema.tableNames.includes(table)) throw Error(`Error in LocalDatabase.select: The specified table (${table}) was not found in the schema used to initialise the database.`);
        return new Promise((success, reject) => {
            // Destructure query into $lt, $lte, $gte, $gt, $ne
            // The below arrays will be populated with a series of arrays like: [columnName, columnEntry]
            const additiveQueries = [];
            const subtractiveQueries = [];
            for(const [columnName, columnEntry] of Object.entries(query)) {
                // Basic query for exact matches
                if(LocalDatabase._isPrimitive(columnEntry) || columnEntry === null) {
                    additiveQueries.push([columnName, columnEntry]);
                    continue;
                }


                // Get the highest greater than value
                let greaterThan = columnEntry.$gt !== undefined ? columnEntry.$gt : columnEntry.$gte;
                if(columnEntry.$gt !== undefined && columnEntry.$gte !== undefined) {
                    greaterThan = Math.max(columnEntry.$gt, columnEntry.$gte);
                }
                const isGte = greaterThan === columnEntry.$gte;
                // Get the lowest less than value
                let lessThan = columnEntry.$lt !== undefined ? columnEntry.$lt : columnEntry.$lte;
                if(columnEntry.$lt !== undefined && columnEntry.$lte !== undefined) {
                    lessThan = Math.min(columnEntry.$lt, columnEntry.$lte);
                }
                const isLte = lessThan === columnEntry.$lte;


                // Within a range
                if(lessThan !== undefined && greaterThan !== undefined)
                    additiveQueries.push([columnName, IDBKeyRange.bound(greaterThan, lessThan, !isGte, !isLte)]);

                // Less than, no greater than
                if(lessThan !== undefined && greaterThan === undefined)
                    additiveQueries.push([columnName, IDBKeyRange.upperBound(columnEntry.$lt, !isLte)]);

                // Greater than, no less than
                if(lessThan === undefined && greaterThan !== undefined)
                    additiveQueries.push([columnName, IDBKeyRange.lowerBound(columnEntry.$gt, !isGte)]);

                // Not equal to
                if(columnEntry.$ne !== undefined)
                    subtractiveQueries.push([columnName, columnEntry.$ne]);
                    
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
            const additivePromises = getPromisesFromQueryArray(additiveQueries);
            // Perform subtractive queries
            const subtractivePromises = getPromisesFromQueryArray(subtractiveQueries);

            // Await all additive promises' completion
            Promise.all(additivePromises).then(additiveResult => {
                // If there is just 1 result, and there is no $ne queries return that.
                if(subtractiveQueries.length === 0 && additiveResult.length <= 1) {
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

    static delete(table, query) {
        if(!LocalDatabase.instance) throw Error("Error in LocalDatabase.delete: The database has not yet been initialised! Please make sure you run `await LocalDatabase.init()` before using this.");
        if(!table) throw Error("Error in LocalDatabase.delete: No table defined.");
        if(!LocalDatabase.schema.tableNames.includes(table)) throw Error(`Error in LocalDatabase.delete: The specified table (${table}) was not found in the schema used to initialise the database.`);

        return new Promise(success => {
            // Select all entries to be deleted
            LocalDatabase.select(table, query).then(results => {
                // Find out what the key column is for this table
                const tableSchema = LocalDatabase.schema.tableMap[table];
                const keyColumn = tableSchema.keyColumn.name;
        
                // Get an array of keys from the results.
                const keyArray = results.map(entry => entry[keyColumn]);
                // Initiate delete 
                const deletePromises = [];
                for(const key of keyArray) {
                    deletePromises.push(new Promise((delSuccess, delReject) => {
                        const txn = LocalDatabase.instance.transaction([tableSchema.name], "readwrite");
                        txn.objectStore(tableSchema.name).delete(key);

                        txn.oncomplete = event => { 
                            delSuccess(event);
                        }
                        txn.onerror = event => {
                            console.error(`Error in LocalDatabase.delete for store (${table}). Query, Event:`, query, event);
                            reject(new Error(`Error in LocalDatabase.delete for store (${table}). Check console.`));
                        }
                    }))
                }
                Promise.all(deletePromises).then(resolution => success(resolution));
            });
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

export default LocalDatabase