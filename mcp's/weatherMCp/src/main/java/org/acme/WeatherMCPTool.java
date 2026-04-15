package org.acme;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolResponse;
import jakarta.enterprise.context.ApplicationScoped;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@ApplicationScoped
public class WeatherMCPTool {

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Tool(description = "Obtiene el clima actual de una ciudad usando Open-Meteo.")
    ToolResponse getWeather(
            @ToolArg(description = "Nombre de la ciudad a consultar, por ejemplo Madrid o Buenos Aires") String city)
            throws Exception {
        String normalizedCity = city == null ? "" : city.trim();
        if (normalizedCity.isEmpty()) {
            return ToolResponse.error("El parametro city es obligatorio.");
        }

        String encodedCity = URLEncoder.encode(normalizedCity, StandardCharsets.UTF_8);
        String geoUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" + encodedCity + "&count=1";
        HttpRequest geoRequest = HttpRequest.newBuilder()
                .uri(URI.create(geoUrl))
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> geoResponse = httpClient.send(geoRequest, HttpResponse.BodyHandlers.ofString());
        if (geoResponse.statusCode() >= 400) {
            return ToolResponse.error("No fue posible resolver la ciudad solicitada.");
        }

        JsonNode results = objectMapper.readTree(geoResponse.body()).path("results");
        if (!results.isArray() || results.isEmpty()) {
            return ToolResponse.error("No se encontro informacion para la ciudad: " + normalizedCity);
        }

        JsonNode firstResult = results.get(0);
        double latitude = firstResult.path("latitude").asDouble();
        double longitude = firstResult.path("longitude").asDouble();
        String cityName = firstResult.path("name").asText(normalizedCity);
        String country = firstResult.path("country").asText("");

        String weatherUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + latitude
                + "&longitude=" + longitude
                + "&current=temperature_2m,precipitation";
        HttpRequest weatherRequest = HttpRequest.newBuilder()
                .uri(URI.create(weatherUrl))
                .timeout(Duration.ofSeconds(15))
                .build();

        HttpResponse<String> weatherResponse = httpClient.send(weatherRequest, HttpResponse.BodyHandlers.ofString());
        if (weatherResponse.statusCode() >= 400) {
            return ToolResponse.error("No fue posible obtener el clima actual.");
        }

        JsonNode current = objectMapper.readTree(weatherResponse.body()).path("current");
        if (current.isMissingNode()) {
            return ToolResponse.error("La respuesta del proveedor meteorologico no incluye datos actuales.");
        }

        double temperature = current.path("temperature_2m").asDouble();
        double precipitation = current.path("precipitation").asDouble();
        String location = country.isBlank() ? cityName : cityName + ", " + country;
        String message = "Clima actual en " + location + ": " + temperature + " C y " + precipitation
                + " mm de precipitacion.";

        return ToolResponse.success(new TextContent(message));
    }
}
