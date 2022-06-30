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
     * Initialise the LocalDatabase system.
     * @async Make sure to await this method's completion before using any of the LocalDatabase database methods (select, add).
     */
    static init(database) {
        if (!window.indexedDB) {
            throw Error("Your browser doesn't support a stable version of IndexedDB. As such, this app cannot run properly.");
        }

        // Open the instance
        const opening = window.indexedDB.open(database, LocalDatabase.version);

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
                console.log("LocalDatabase: Upgrade required...")
                LocalDatabase.upgrade(event)
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
     * Upgrades & initialises the database.
     * @param {*} event 
     */
    static upgrade(event) {
        console.log("LocalDatabase: Upgrading database... Please wait.");
        LocalDatabase.instance = event.target.result;

        /**
         * @important Make sure you update the `LocalDatabase.version` 
         */

        // Create store
        const itemsStore = LocalDatabase.instance.createObjectStore("items", { keyPath: "name" });
        // Define indexes
        itemsStore.createIndex("image", "image", {unique: false});
        itemsStore.createIndex("type", "type", {unique: false});
        itemsStore.createIndex("description", "description", {unique: false});
        itemsStore.createIndex("listable", "listable", {unique: false});
        itemsStore.createIndex("networks", "networks", {unique: false});

        itemsStore.transaction.oncomplete = event => {
            // Add default records to the database
            // itemsStore.

        }
    }

    /**
     * @typedef AddOptions
     * @property {Boolean} upsert https://en.wikipedia.org/wiki/Merge_(SQL)#Synonymous
     */

    /**
     * Inserts (or updates on collision) an item to an object store.
     * @param {String} storeName
     * @param {Object} object 
     * @param {AddOptions} options 
     * @returns {Promise}
     * @async
     */
    static add(storeName, object, options = { upsert: true }) {
        if(!LocalDatabase.instance) throw Error("Error in LocalDatabase.add: The database has not yet been initialised! Please make sure you run `await LocalDatabase.init()` before using this.");
        if(!storeName) throw Error("Error in LocalDatabase.add: No store defined.");
        return new Promise((success, reject) => {
            const txn = LocalDatabase.instance.transaction(storeName, "readwrite");
            const store = txn.objectStore(storeName);

            if(options.upsert)
                store.put(object);
            else
                store.add(object);
            
            txn.oncomplete = event => {
                success(event);
            }

            txn.onerror = event => {
                console.error(`Error in LocalDatabase.add for store (${storeName}). Object, Options, Event:`, object, options, event);
                reject(new Error(`Error in LocalDatabase.add for store (${storeName}). Check console.`));
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
     * @note All column queries are 1 layer deep. If you want to query a column that contains an object, write the column name as `{"firstLayer.secondLayer": desiredValue}`
     * 
     * @note Selectors are $lt (Less Than), $gt (Greater Than), and $ne (Not Equal To)
     * 
     * @param {String} storeName 
     * @param {*} query 
     */
    static select(storeName, query) {
        if(!LocalDatabase.instance) throw Error("Error in LocalDatabase.select: The database has not yet been initialised! Please make sure you run `await LocalDatabase.init()` before using this.");
        if(!storeName) throw Error("Error in LocalDatabase.select: No store defined.");
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
                const txn = LocalDatabase.instance.transaction(storeName, "readonly");
                const store = txn.objectStore(storeName);
                const allPromises = [];
                for(const query of queryArray) {
                    allPromises.push(new Promise(complete => {
                        const index = LocalDatabase._getIndex(store, query[0], "Error in LocalDatabase.select"); // [0] is the columnName
                        const action = index.getAll(query[1]); // [1] is the value we want
                        action.onsuccess = event => complete(event.target.result)
                        action.onerror = event => {
                            console.error(`Error in LocalDatabase.select for store (${storeName}). Query, Event:`, query, event);
                            reject(new Error(`Error in LocalDatabase.select for store (${storeName}). Check console.`));
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
            throw Error(`${errorMessagePrepend}\nErrored while trying to retrieve index (${name}) from object store. Make sure your specified index exists and is available!\n\nIndexedDb Error:\n${error.message}`);
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

}

export default LocalDatabase