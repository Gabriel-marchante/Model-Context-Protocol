package org.acme;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.not;

@QuarkusTest
class McpServerTest {

    private static final String ACCEPT_HEADER = "application/json, text/event-stream";
    private static final String SESSION_HEADER = "Mcp-Session-Id";

    @Test
    void initializeReturnsProtocolMetadataAndSessionId() {
        given()
                .header("Accept", ACCEPT_HEADER)
                .contentType("application/json")
                .body("""
                        {
                          \"jsonrpc\": \"2.0\",
                          \"id\": 1,
                          \"method\": \"initialize\",
                          \"params\": {
                            \"protocolVersion\": \"2025-11-25\",
                            \"clientInfo\": {
                              \"name\": \"rest-assured\",
                              \"version\": \"1.0.0\"
                            },
                            \"capabilities\": {}
                          }
                        }
                        """)
                .when()
                .post("/mcp/v1")
                .then()
                .statusCode(200)
                .header(SESSION_HEADER, not(blankOrNullString()))
                .body("jsonrpc", equalTo("2.0"))
                .body("id", equalTo(1))
                .body("result.protocolVersion", equalTo("2025-11-25"))
                .body("result.serverInfo.name", not(blankOrNullString()))
                .body("result.serverInfo.version", not(blankOrNullString()))
                .body("result.capabilities", hasKey("tools"));
    }

    @Test
    void toolsListExposesWeatherToolAfterInitialization() {
        String sessionId = given()
                .header("Accept", ACCEPT_HEADER)
                .contentType("application/json")
                .body("""
                        {
                          \"jsonrpc\": \"2.0\",
                          \"id\": 1,
                          \"method\": \"initialize\",
                          \"params\": {
                            \"protocolVersion\": \"2025-11-25\",
                            \"clientInfo\": {
                              \"name\": \"rest-assured\",
                              \"version\": \"1.0.0\"
                            },
                            \"capabilities\": {}
                          }
                        }
                        """)
                .when()
                .post("/mcp/v1")
                .then()
                .statusCode(200)
                .extract()
                .header(SESSION_HEADER);

        given()
                .header("Accept", ACCEPT_HEADER)
                .header(SESSION_HEADER, sessionId)
                .contentType("application/json")
                .body("""
                        {
                          \"jsonrpc\": \"2.0\",
                          \"id\": 2,
                          \"method\": \"tools/list\",
                          \"params\": {}
                        }
                        """)
                .when()
                .post("/mcp/v1")
                .then()
                .statusCode(200)
                .body("jsonrpc", equalTo("2.0"))
                .body("id", equalTo(2))
                .body("result.tools.name", hasItem("getWeather"))
                .body("result.tools.description", hasItem("Obtiene el clima actual de una ciudad usando Open-Meteo."));
    }
}
