#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createStatelessServer } from "@smithery/sdk/server/stateless.js";
import { z } from "zod";

// Weather.gov API base URL
const WEATHER_API_BASE = "https://api.weather.gov";

// User-Agent header required by weather.gov API
const USER_AGENT = "us-weather-mcp-server/1.0.0 (contact@smithery.ai)";

// Type definitions based on the OpenAPI specification
interface PointMetadata {
	gridId: string;
	gridX: number;
	gridY: number;
	cwa: string;
	forecastOffice: string;
	forecast: string;
	forecastHourly: string;
}

interface WeatherApiResponse {
	properties: unknown;
	features?: Array<{ properties: unknown }>;
}

interface StationCollection {
	features: Array<{
		properties: {
			stationIdentifier: string;
			name: string;
			elevation?: { value: number };
			distance?: { value: number };
		};
	}>;
}

interface ForecastResponse {
	properties: {
		updateTime: string;
		periods: Array<{
			name: string;
			temperature: number;
			temperatureUnit: string;
			shortForecast: string;
			detailedForecast: string;
			windSpeed?: string;
			windDirection?: string;
			probabilityOfPrecipitation?: { value: number };
		}>;
	};
}

interface HourlyForecastResponse {
	properties: {
		updateTime: string;
		periods: Array<{
			startTime: string;
			temperature: number;
			temperatureUnit: string;
			shortForecast: string;
			probabilityOfPrecipitation?: { value: number };
		}>;
	};
}

interface AlertCollection {
	features: Array<{
		properties: {
			event: string;
			severity: string;
			urgency: string;
			areaDesc: string;
			effective?: string;
			expires?: string;
			description: string;
			instruction?: string;
		};
	}>;
}

interface ObservationResponse {
	properties: {
		timestamp: string;
		temperature?: { value: number | null };
		heatIndex?: { value: number | null };
		windChill?: { value: number | null };
		textDescription?: string;
		relativeHumidity?: { value: number | null };
		windSpeed?: { value: number | null };
		windDirection?: { value: number | null };
		barometricPressure?: { value: number | null };
		visibility?: { value: number | null };
	};
}

// Helper function to make weather API requests
async function weatherApiRequest(endpoint: string): Promise<unknown> {
	try {
		const response = await fetch(`${WEATHER_API_BASE}${endpoint}`, {
			headers: {
				"User-Agent": USER_AGENT,
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			// Handle specific weather.gov API error cases
			if (response.status === 404) {
				throw new Error("Location not found or no data available");
			}
			if (response.status === 500) {
				throw new Error("Weather service temporarily unavailable");
			}
			throw new Error(
				`Weather API error: ${response.status} ${response.statusText}`,
			);
		}

		return await response.json();
	} catch (error: unknown) {
		if (error instanceof Error && error.message.includes("fetch")) {
			throw new Error(
				"Unable to connect to weather service. Please check your internet connection.",
			);
		}
		throw error;
	}
}

// Helper to parse location input (coordinates, city name, etc.)
async function parseLocation(
	location: string,
): Promise<{ latitude: number; longitude: number }> {
	// Check if it's already coordinates (lat,lng format)
	const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
	if (coordMatch) {
		return {
			latitude: Number.parseFloat(coordMatch[1]),
			longitude: Number.parseFloat(coordMatch[2]),
		};
	}

	// For now, return an error - in a full implementation, we'd use a geocoding service
	throw new Error(
		`Location parsing not yet implemented for "${location}". Please provide coordinates in "latitude,longitude" format (e.g., "40.7128,-74.0060")`,
	);
}

// Helper to get point metadata from coordinates
async function getPointMetadata(
	latitude: number,
	longitude: number,
): Promise<PointMetadata> {
	const data = (await weatherApiRequest(
		`/points/${latitude},${longitude}`,
	)) as { properties: PointMetadata };
	return data.properties;
}

// Create stateless server
const { app } = createStatelessServer<Record<string, never>>(() => {
	try {
		console.log("Starting Weather MCP Server...");

		const server = new McpServer({
			name: "United States Weather MCP Server",
			version: "1.0.0",
		});

		// Tool: Get Current Weather
		server.tool(
			"get_current_weather",
			"Get current weather conditions for a location in the United States. Perfect for 'What's the weather like in [US location]?' questions. Covers all US states, territories, and coastal waters.",
			{
				location: z
					.string()
					.describe(
						"US location as coordinates (lat,lng) in decimal degrees. Example: '40.7128,-74.0060' for New York City. Must be within US boundaries including states, territories (PR, VI, AS, GU, MP), and coastal waters.",
					),
			},
			async ({ location }) => {
				try {
					const coords = await parseLocation(location);
					const pointData = await getPointMetadata(
						coords.latitude,
						coords.longitude,
					);

					// Get nearest station and latest observation
					const stationsData = (await weatherApiRequest(
						`/gridpoints/${pointData.gridId}/${pointData.gridX},${pointData.gridY}/stations`,
					)) as StationCollection;

					if (!stationsData.features || stationsData.features.length === 0) {
						throw new Error("No weather stations found for this location");
					}

					const nearestStation =
						stationsData.features[0].properties.stationIdentifier;
					const observationData = (await weatherApiRequest(
						`/stations/${nearestStation}/observations/latest`,
					)) as ObservationResponse;
					const obs = observationData.properties;

					// Format current weather as markdown
					let markdown = "# Current Weather\n\n";
					markdown += `**Location:** ${coords.latitude}, ${coords.longitude}\n`;
					markdown += `**Station:** ${nearestStation}\n`;
					markdown += `**Observed:** ${new Date(obs.timestamp).toLocaleString()}\n\n`;

					// Temperature
					if (obs.temperature && obs.temperature.value !== null) {
						const tempF = (obs.temperature.value * 9) / 5 + 32;
						markdown += `**Temperature:** ${tempF.toFixed(1)}°F (${obs.temperature.value.toFixed(1)}°C)\n`;
					}

					// "Feels like" temperature
					if (obs.heatIndex && obs.heatIndex.value !== null) {
						const feelsF = (obs.heatIndex.value * 9) / 5 + 32;
						markdown += `**Feels Like:** ${feelsF.toFixed(1)}°F (heat index)\n`;
					} else if (obs.windChill && obs.windChill.value !== null) {
						const feelsF = (obs.windChill.value * 9) / 5 + 32;
						markdown += `**Feels Like:** ${feelsF.toFixed(1)}°F (wind chill)\n`;
					}

					// Conditions
					if (obs.textDescription) {
						markdown += `**Conditions:** ${obs.textDescription}\n`;
					}

					// Humidity
					if (obs.relativeHumidity && obs.relativeHumidity.value !== null) {
						markdown += `**Humidity:** ${obs.relativeHumidity.value.toFixed(0)}%\n`;
					}

					// Wind
					if (
						obs.windSpeed &&
						obs.windSpeed.value !== null &&
						obs.windDirection &&
						obs.windDirection.value !== null
					) {
						const windMph = (obs.windSpeed.value * 2.237).toFixed(0);
						const windDir = obs.windDirection.value;
						markdown += `**Wind:** ${windMph} mph from ${windDir}°\n`;
					}

					// Pressure
					if (obs.barometricPressure && obs.barometricPressure.value !== null) {
						const pressureInHg = (
							obs.barometricPressure.value * 0.0002953
						).toFixed(2);
						markdown += `**Pressure:** ${pressureInHg} inHg\n`;
					}

					// Visibility
					if (obs.visibility && obs.visibility.value !== null) {
						const visibilityMiles = (obs.visibility.value / 1609.34).toFixed(1);
						markdown += `**Visibility:** ${visibilityMiles} miles\n`;
					}

					return {
						content: [{ type: "text", text: markdown }],
					};
				} catch (e: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
							},
						],
					};
				}
			},
		);

		// Tool: Get Weather Forecast
		server.tool(
			"get_weather_forecast",
			"Get multi-day weather forecast for a location in the United States. Perfect for 'What's the forecast for [US location]?' questions. Provides detailed day/night forecasts for up to 7 days.",
			{
				location: z
					.string()
					.describe(
						"US location as coordinates (lat,lng) in decimal degrees. Example: '40.7128,-74.0060' for New York City. Must be within US boundaries including states, territories (PR, VI, AS, GU, MP), and coastal waters.",
					),
				days: z
					.number()
					.optional()
					.default(7)
					.describe(
						"Number of days to forecast (1-7, default 7). Each day includes both day and night periods.",
					),
			},
			async ({ location, days }) => {
				try {
					const coords = await parseLocation(location);
					const pointData = await getPointMetadata(
						coords.latitude,
						coords.longitude,
					);

					// Get forecast
					const forecastData = (await weatherApiRequest(
						`/gridpoints/${pointData.gridId}/${pointData.gridX},${pointData.gridY}/forecast`,
					)) as ForecastResponse;
					const periods = forecastData.properties.periods.slice(0, days * 2); // Each day has day/night periods

					let markdown = `# ${days}-Day Weather Forecast\n\n`;
					markdown += `**Location:** ${coords.latitude}, ${coords.longitude}\n`;
					markdown += `**Updated:** ${new Date(forecastData.properties.updateTime).toLocaleString()}\n\n`;

					for (const period of periods) {
						markdown += `## ${period.name}\n\n`;
						markdown += `**Temperature:** ${period.temperature}°${period.temperatureUnit}\n`;
						markdown += `**Conditions:** ${period.shortForecast}\n`;

						if (period.probabilityOfPrecipitation?.value) {
							markdown += `**Precipitation:** ${period.probabilityOfPrecipitation.value}% chance\n`;
						}

						if (period.windSpeed && period.windDirection) {
							markdown += `**Wind:** ${period.windSpeed} ${period.windDirection}\n`;
						}

						markdown += `\n${period.detailedForecast}\n\n`;
						markdown += "---\n\n";
					}

					return {
						content: [{ type: "text", text: markdown }],
					};
				} catch (e: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
							},
						],
					};
				}
			},
		);

		// Tool: Get Hourly Forecast
		server.tool(
			"get_hourly_forecast",
			"Get hour-by-hour weather forecast for a location in the United States. Perfect for 'What's the hourly forecast?' or 'Will it rain this afternoon in [US location]?' questions. Provides detailed hourly conditions for up to 48 hours.",
			{
				location: z
					.string()
					.describe(
						"US location as coordinates (lat,lng) in decimal degrees. Example: '40.7128,-74.0060' for New York City. Must be within US boundaries including states, territories (PR, VI, AS, GU, MP), and coastal waters.",
					),
				hours: z
					.number()
					.optional()
					.default(24)
					.describe(
						"Number of hours to forecast (1-48, default 24). Provides temperature, conditions, and precipitation probability for each hour.",
					),
			},
			async ({ location, hours }) => {
				try {
					const coords = await parseLocation(location);
					const pointData = await getPointMetadata(
						coords.latitude,
						coords.longitude,
					);

					// Get hourly forecast
					const forecastData = (await weatherApiRequest(
						`/gridpoints/${pointData.gridId}/${pointData.gridX},${pointData.gridY}/forecast/hourly`,
					)) as HourlyForecastResponse;
					const periods = forecastData.properties.periods.slice(0, hours);

					let markdown = `# ${hours}-Hour Weather Forecast\n\n`;
					markdown += `**Location:** ${coords.latitude}, ${coords.longitude}\n`;
					markdown += `**Updated:** ${new Date(forecastData.properties.updateTime).toLocaleString()}\n\n`;

					for (const period of periods) {
						const time = new Date(period.startTime);
						const timeStr = time.toLocaleTimeString([], {
							hour: "numeric",
							hour12: true,
						});
						const dateStr = time.toLocaleDateString();

						markdown += `**${timeStr} (${dateStr})** - ${period.temperature}°${period.temperatureUnit} - ${period.shortForecast}`;

						if (period.probabilityOfPrecipitation?.value) {
							markdown += ` - ${period.probabilityOfPrecipitation.value}% rain`;
						}

						markdown += "\n";
					}

					return {
						content: [{ type: "text", text: markdown }],
					};
				} catch (e: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
							},
						],
					};
				}
			},
		);

		// Tool: Get Weather Alerts
		server.tool(
			"get_weather_alerts",
			"Get active weather alerts, warnings, watches, and advisories for locations in the United States. Perfect for 'Are there any weather alerts in [US location]?' questions. Covers severe weather, winter storms, heat warnings, flood alerts, and more.",
			{
				location: z
					.string()
					.describe(
						"US location as coordinates (lat,lng) in decimal degrees OR 2-letter state/territory code. Examples: '40.7128,-74.0060' for New York City, 'CA' for California, 'PR' for Puerto Rico. Valid state codes: AL, AK, AS, AR, AZ, CA, CO, CT, DE, DC, FL, GA, GU, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, PR, RI, SC, SD, TN, TX, UT, VT, VI, VA, WA, WV, WI, WY, MP, PW, FM, MH.",
					),
				severity: z
					.enum(["all", "extreme", "severe", "moderate", "minor"])
					.optional()
					.default("all")
					.describe(
						"Filter by alert severity: 'extreme' (life-threatening), 'severe' (significant threat), 'moderate' (possible threat), 'minor' (minimal threat), or 'all' (default - shows all active alerts).",
					),
			},
			async ({ location, severity }) => {
				try {
					let alertsEndpoint = "/alerts/active";

					// Check if it's a state code
					if (location.length === 2 && location.match(/^[A-Z]{2}$/)) {
						alertsEndpoint += `/area/${location}`;
					} else {
						// Try to parse as coordinates
						try {
							const coords = await parseLocation(location);
							alertsEndpoint += `?point=${coords.latitude},${coords.longitude}`;
						} catch {
							// If not coordinates, search by area - for now just get all active alerts
							alertsEndpoint = "/alerts/active";
						}
					}

					const alertsData = (await weatherApiRequest(
						alertsEndpoint,
					)) as AlertCollection;
					const alerts = alertsData.features || [];

					// Filter by severity if specified
					const filteredAlerts =
						severity === "all"
							? alerts
							: alerts.filter(
									(alert) =>
										alert.properties.severity?.toLowerCase() === severity,
								);

					if (filteredAlerts.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: `# Weather Alerts\n\nNo active weather alerts found for ${location}.`,
								},
							],
						};
					}

					let markdown = `# Weather Alerts for ${location}\n\n`;
					markdown += `Found ${filteredAlerts.length} active alert(s)\n\n`;

					for (const alert of filteredAlerts) {
						const props = alert.properties;
						markdown += `## ${props.event}\n\n`;
						markdown += `**Severity:** ${props.severity}\n`;
						markdown += `**Urgency:** ${props.urgency}\n`;
						markdown += `**Areas:** ${props.areaDesc}\n`;

						if (props.effective) {
							markdown += `**Effective:** ${new Date(props.effective).toLocaleString()}\n`;
						}

						if (props.expires) {
							markdown += `**Expires:** ${new Date(props.expires).toLocaleString()}\n`;
						}

						markdown += `\n**Description:**\n${props.description}\n\n`;

						if (props.instruction) {
							markdown += `**Instructions:**\n${props.instruction}\n\n`;
						}

						markdown += "---\n\n";
					}

					return {
						content: [{ type: "text", text: markdown }],
					};
				} catch (e: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
							},
						],
					};
				}
			},
		);

		// Tool: Find Weather Stations
		server.tool(
			"find_weather_stations",
			"Find weather observation stations near a location in the United States. Useful for getting station-specific data, finding data sources, or understanding which stations provide weather data for an area. Includes ASOS, AWOS, and other automated weather stations.",
			{
				location: z
					.string()
					.describe(
						"US location as coordinates (lat,lng) in decimal degrees. Example: '40.7128,-74.0060' for New York City. Must be within US boundaries including states, territories (PR, VI, AS, GU, MP), and coastal waters.",
					),
				limit: z
					.number()
					.optional()
					.default(10)
					.describe(
						"Maximum number of stations to return (1-20, default 10). Stations are returned ordered by distance from the specified location.",
					),
			},
			async ({ location, limit }) => {
				try {
					const coords = await parseLocation(location);
					const pointData = await getPointMetadata(
						coords.latitude,
						coords.longitude,
					);

					// Get stations for this gridpoint
					const stationsData = (await weatherApiRequest(
						`/gridpoints/${pointData.gridId}/${pointData.gridX},${pointData.gridY}/stations?limit=${limit}`,
					)) as StationCollection;
					const stations = stationsData.features || [];

					if (stations.length === 0) {
						return {
							content: [
								{
									type: "text",
									text: `# Weather Stations\n\nNo weather stations found near ${location}.`,
								},
							],
						};
					}

					let markdown = `# Weather Stations Near ${location}\n\n`;
					markdown += `Found ${stations.length} station(s)\n\n`;

					for (const station of stations) {
						const props = station.properties;
						markdown += `## ${props.name}\n\n`;
						markdown += `**Station ID:** ${props.stationIdentifier}\n`;

						if (props.elevation?.value) {
							const elevationFt = (props.elevation.value * 3.28084).toFixed(0);
							markdown += `**Elevation:** ${elevationFt} ft\n`;
						}

						if (props.distance?.value) {
							const distanceMiles = (
								(props.distance.value / 1000) *
								0.621371
							).toFixed(1);
							markdown += `**Distance:** ${distanceMiles} miles\n`;
						}

						// Try to get latest observation
						try {
							const obsData = (await weatherApiRequest(
								`/stations/${props.stationIdentifier}/observations/latest`,
							)) as ObservationResponse;
							if (obsData.properties) {
								const obs = obsData.properties;
								markdown += `**Latest Report:** ${new Date(obs.timestamp).toLocaleString()}\n`;

								if (obs.temperature && obs.temperature.value !== null) {
									const tempF = (obs.temperature.value * 9) / 5 + 32;
									markdown += `**Temperature:** ${tempF.toFixed(1)}°F\n`;
								}
							}
						} catch {
							markdown += "**Latest Report:** Not available\n";
						}

						markdown += "\n---\n\n";
					}

					return {
						content: [{ type: "text", text: markdown }],
					};
				} catch (e: unknown) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
							},
						],
					};
				}
			},
		);

		return server.server;
	} catch (e) {
		console.error(e);
		throw e;
	}
});

// Start the server
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
	console.log(`Weather MCP server running on port ${PORT}`);
});
