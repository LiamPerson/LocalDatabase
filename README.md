# LocalDatabase
<h3>A simple front-end embedded database that wraps <a href="https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API">IndexedDB</a>.</h3>


# Inserting & Updating

Inserting and updating are a single combined action and referred to as `add`.

You can add a single entry into the database using:

```js
await LocalDatabase.add("PersonsTable", 
    {id: 1, firstName: "John", lastName: "Doe", age: 42}
);
```

You can add multiple entries into the database using:

```js
await LocalDatabase.multiAdd("PersonsTable", [
    {id: 4, firstName: "David", lastName: "Gray", age: 20},
    {id: 6, firstName: "John", lastName: "Gilmore", age: 69},
    {id: 5, firstName: "John", lastName: "Robson", age: 69},
    {id: 3, firstName: "Harry", lastName: "Gardener", age: 66}
]);
```


# Select Queries
To select someone from the *People* table that has the firstName John, age 69, and their last name is not Gilmore:

<h3>PersonsTable</h3>

<table>
    <thead>
        <tr>
            <th>id</th>
            <th>firstName</th>
            <th>lastName</th>
            <th>age</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>John</td>
            <td>Doe</td>
            <td>42</td>
        </tr>
        <tr>
            <td>2</td>
            <td>Bob</td>
            <td>Smith</td>
            <td>35</td>
        </tr>
        <tr>
            <td>4</td>
            <td>David</td>
            <td>Gray</td>
            <td>20</td>
        </tr>
        <tr>
            <td>6</td>
            <td>John</td>
            <td>Gilmore</td>
            <td>69</td>
        </tr>
        <tr>
            <td>5</td>
            <td>John</td>
            <td>Robson</td>
            <td>69</td>
        </tr>
        <tr>
            <td>3</td>
            <td>Harry</td>
            <td>Gardener</td>
            <td>66</td>
        </tr>
    </tbody>
</table>

```js
await LocalDatabase.select("PersonsTable", {firstName: "John", age: 69, lastName: {$ne: "Gilmore"}});
```
The above line of code selects the following row:

<table>
    <tbody>
        <tr>
            <td>6</td>
            <td>John</td>
            <td>Gilmore</td>
            <td>69</td>
        </tr>
    </tbody>
</table>



# NodeJS

This embedded database is made for use on the front-end of a website although you can modify `export default` to `module.exports` in all classes:
```js
export default LocalDatabase;
```
to 
```js
module.exports = LocalDatabase;
``` 
to use this in NodeJS.

# Example usage:
```html
<script src="LocalDatabase.all.js"></script>
<script>
    (async() => {
        // Create the schema
        const peopleTable = new LocalDatabase.Table("People", 
            new LocalDatabase.Column("id", {unique: true}),
            [
                new LocalDatabase.Column("firstName"),
                new LocalDatabase.Column("lastName"),
                new LocalDatabase.Column("age")
            ]
        );
        const dbSchema = new LocalDatabase.Database("MyDatabase", [peopleTable]);

        // Initialise the database
        await LocalDatabase.init(dbSchema);

        // Insert some data
        await LocalDatabase.add(peopleTable.name, {id: 1, firstName: "John", lastName: "Doe", age: 42});
        await LocalDatabase.add("People", {id: 2, firstName: "Bob", lastName: "Smith", age: 35});
        await LocalDatabase.multiAdd(peopleTable.name, [
            {id: 4, firstName: "David", lastName: "Gray", age: 20},
            {id: 6, firstName: "John", lastName: "Gilmore", age: 69},
            {id: 5, firstName: "John", lastName: "Robson", age: 69},
            {id: 3, firstName: "Harry", lastName: "Gardener", age: 66}
        ]);

        // Query the database
        const allEntries = await LocalDatabase.select("People", {age: {$gt: 0}});
        console.log("All Entries", allEntries);
        const queryResult = await LocalDatabase.select("People", {firstName: "John", age: 69, lastName: {$ne: "Gilmore"}});
        console.log("Query result:", queryResult);
    })()
</script>
```