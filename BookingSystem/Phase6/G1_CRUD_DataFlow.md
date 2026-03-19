# 1️⃣ CREATE – Resource (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant F as Frontend (form.js and resources.js)
    participant B as Backend (Express Route)
    participant V as express-validator
    participant S as Resource Service
    participant DB as PostgreSQL

    U->>F: Submit form
    F->>F: Client-side validation
    F->>B: POST /api/resources (JSON)

    B->>V: Validate request
    V-->>B: Validation result

    alt Validation fails
        B-->>F: 400 Bad Request + errors[]
        F-->>U: Show validation message
    else Validation OK
        B->>S: create Resource(data)
        S->>DB: INSERT INTO resources
        DB-->>S: Result / Duplicate error

        alt Duplicate
            S-->>B: Duplicate detected
            B-->>F: 409 Conflict
            F-->>U: Show duplicate message
        else Success
            S-->>B: Created resource
            B-->>F: 201 Created
            F-->>U: Show success message
        end
    end
```

# 2️⃣ READ — Resource (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant F as Frontend (resources.js)
    participant B as Backend (Express Route)
    participant S as Resource Service
    participant DB as PostgreSQL

    U->>F: Load page / ResourceActionSuccess
    F->>B: GET /api/resources (JSON)


    B->>S: read Resource(data)
    S->>DB: SELECT * FROM resources
    DB-->>S: Result / Database error

    alt Database error
        S-->>B: Read error detected
        B-->>F: 500 Database error
        F-->>U: Log to console and clear resource list
    else Success
        S-->>B: read Resource
        B-->>F: 200 Ok
        F-->>U: Show resource list
    end
```

# 3️⃣ UPDATE — Resource (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant F as Frontend (form.js and resources.js)
    participant B as Backend (Express Route)
    participant V as express-validator
    participant S as Resource Service
    participant DB as PostgreSQL

    U->>F: Submit form
    F->>F: Client-side validation
    F->>B: PUT /api/resources/:id (JSON)

    alt Invalid id
        B-->>F: 400 Invalid id
        F-->>U: Shows validation message
    else Valid id
        B->>V: Validate request
        V-->>B: Validation result

        alt Validation fails
            B-->>F: 400 Bad Request + errors[]
            F-->>U: Show validation message
        else Validation OK
            B->>S: update Resource(data)
            S->>DB: UPDATE resources SET [...] RETURNING *
            DB-->>S: Result / Not found / Database error

            alt Not found
                S-->>B: Not found detected
                B-->>F: 404 Resource not found
                F-->>U: Show not found message
            else Database error
                S-->>B: Database error
                B-->>F: 500 Database error
                F-->>U: Show generic error message
            else Success
                S-->>B: Updated resource
                B-->>F: 200 Ok
                F-->>U: Show success message
            end
        end
    end
```

# 4️⃣ DELETE — Resource (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant F as Frontend (form.js)
    participant B as Backend (Express Route)
    participant S as Resource Service
    participant DB as PostgreSQL

    U->>F: Submit form
    F->>B: DELETE /api/resources/:id (JSON)

    alt Invalid id
        B-->>F: 400 Invalid id
        F-->>U: Shows validation message
    else Valid id
        B->>S: delete Resource(data)
        S->>DB: DELETE FROM resources
        DB-->>S: Result / Not found / Database error

        alt Not found
            S-->>B: Not found detected
            B-->>F: 404 Resource not found
            F-->>U: Show not found message
        else Database error
            S-->>B: Database error
            B-->>F: 500 Database error
            F-->>U: Show generic error message
        else Success
            S-->>B: Deleted resource
            B-->>F: 204 Delete success
            F-->>U: Show success message
        end
    end
```