#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Response interfaces
interface GoogleMapsResponse {
  status: string;
  error_message?: string;
}

interface GeocodeResponse extends GoogleMapsResponse {
  results: Array<{
    place_id: string;
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      }
    };
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
  }>;
}

interface PlacesSearchResponse extends GoogleMapsResponse {
  results: Array<{
    name: string;
    place_id: string;
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      }
    };
    rating?: number;
    types: string[];
  }>;
}

interface PlaceDetailsResponse extends GoogleMapsResponse {
  result: {
    name: string;
    place_id: string;
    formatted_address: string;
    formatted_phone_number?: string;
    website?: string;
    rating?: number;
    reviews?: Array<{
      author_name: string;
      rating: number;
      text: string;
      time: number;
    }>;
    opening_hours?: {
      weekday_text: string[];
      open_now: boolean;
    };
    geometry: {
      location: {
        lat: number;
        lng: number;
      }
    };
  };
}

interface DistanceMatrixResponse extends GoogleMapsResponse {
  origin_addresses: string[];
  destination_addresses: string[];
  rows: Array<{
    elements: Array<{
      status: string;
      duration: {
        text: string;
        value: number;
      };
      distance: {
        text: string;
        value: number;
      };
    }>;
  }>;
}

interface ElevationResponse extends GoogleMapsResponse {
  results: Array<{
    elevation: number;
    location: {
      lat: number;
      lng: number;
    };
    resolution: number;
  }>;
}

interface DirectionsResponse extends GoogleMapsResponse {
  routes: Array<{
    summary: string;
    legs: Array<{
      distance: {
        text: string;
        value: number;
      };
      duration: {
        text: string;
        value: number;
      };
      steps: Array<{
        html_instructions: string;
        distance: {
          text: string;
          value: number;
        };
        duration: {
          text: string;
          value: number;
        };
        travel_mode: string;
      }>;
    }>;
  }>;
}

// Configuration schema
export const configSchema = z.object({
  debug: z.boolean().default(false).describe("Enable debug logging"),
  apiKey: z.string().describe("Google Maps API key"),
});

export default function createStatelessServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const server = new McpServer({
    name: "google-maps-mcp-server",
    version: "0.1.0",
  });

  const GOOGLE_MAPS_API_KEY = config.apiKey;

  // API handlers
  async function handleGeocode(address: string) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.append("address", address);
    url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json() as GeocodeResponse;

    if (data.status !== "OK") {
      throw new Error(`Geocoding failed: ${data.error_message || data.status}`);
    }

    return {
      location: data.results[0].geometry.location,
      formatted_address: data.results[0].formatted_address,
      place_id: data.results[0].place_id
    };
  }

  async function handleReverseGeocode(latitude: number, longitude: number) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.append("latlng", `${latitude},${longitude}`);
    url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json() as GeocodeResponse;

    if (data.status !== "OK") {
      throw new Error(`Reverse geocoding failed: ${data.error_message || data.status}`);
    }

    return {
      formatted_address: data.results[0].formatted_address,
      place_id: data.results[0].place_id,
      address_components: data.results[0].address_components
    };
  }

  async function handlePlaceSearch(
    query: string,
    location?: { latitude: number; longitude: number },
    radius?: number
  ) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.append("query", query);
    url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

    if (location) {
      url.searchParams.append("location", `${location.latitude},${location.longitude}`);
    }
    if (radius) {
      url.searchParams.append("radius", radius.toString());
    }

    const response = await fetch(url.toString());
    const data = await response.json() as PlacesSearchResponse;

    if (data.status !== "OK") {
      throw new Error(`Place search failed: ${data.error_message || data.status}`);
    }

    return {
      places: data.results.map((place) => ({
        name: place.name,
        formatted_address: place.formatted_address,
        location: place.geometry.location,
        place_id: place.place_id,
        rating: place.rating,
        types: place.types
      }))
    };
  }

  async function handlePlaceDetails(place_id: string) {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.append("place_id", place_id);
    url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json() as PlaceDetailsResponse;

    if (data.status !== "OK") {
      throw new Error(`Place details request failed: ${data.error_message || data.status}`);
    }

    return {
      name: data.result.name,
      formatted_address: data.result.formatted_address,
      location: data.result.geometry.location,
      formatted_phone_number: data.result.formatted_phone_number,
      website: data.result.website,
      rating: data.result.rating,
      reviews: data.result.reviews,
      opening_hours: data.result.opening_hours
    };
  }

  async function handleDistanceMatrix(
    origins: string[],
    destinations: string[],
    mode: "driving" | "walking" | "bicycling" | "transit" = "driving"
  ) {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.append("origins", origins.join("|"));
    url.searchParams.append("destinations", destinations.join("|"));
    url.searchParams.append("mode", mode);
    url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json() as DistanceMatrixResponse;

    if (data.status !== "OK") {
      throw new Error(`Distance matrix request failed: ${data.error_message || data.status}`);
    }

    return {
      origin_addresses: data.origin_addresses,
      destination_addresses: data.destination_addresses,
      results: data.rows.map((row) => ({
        elements: row.elements.map((element) => ({
          status: element.status,
          duration: element.duration,
          distance: element.distance
        }))
      }))
    };
  }

  async function handleElevation(locations: Array<{ latitude: number; longitude: number }>) {
    const url = new URL("https://maps.googleapis.com/maps/api/elevation/json");
    const locationString = locations
      .map((loc) => `${loc.latitude},${loc.longitude}`)
      .join("|");
    url.searchParams.append("locations", locationString);
    url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json() as ElevationResponse;

    if (data.status !== "OK") {
      throw new Error(`Elevation request failed: ${data.error_message || data.status}`);
    }

    return {
      results: data.results.map((result) => ({
        elevation: result.elevation,
        location: result.location,
        resolution: result.resolution
      }))
    };
  }

  async function handleDirections(
    origin: string,
    destination: string,
    mode: "driving" | "walking" | "bicycling" | "transit" = "driving"
  ) {
    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.append("origin", origin);
    url.searchParams.append("destination", destination);
    url.searchParams.append("mode", mode);
    url.searchParams.append("key", GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json() as DirectionsResponse;

    if (data.status !== "OK") {
      throw new Error(`Directions request failed: ${data.error_message || data.status}`);
    }

    return {
      routes: data.routes.map((route) => ({
        summary: route.summary,
        distance: route.legs[0].distance,
        duration: route.legs[0].duration,
        steps: route.legs[0].steps.map((step) => ({
          instructions: step.html_instructions,
          distance: step.distance,
          duration: step.duration,
          travel_mode: step.travel_mode
        }))
      }))
    };
  }

  // Register tools
  server.tool(
    "maps_geocode",
    "Convert an address into geographic coordinates",
    {
      address: z.string().describe("The address to geocode"),
    },
    async ({ address }) => {
      const result = await handleGeocode(address);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "maps_reverse_geocode",
    "Convert coordinates into an address",
    {
      latitude: z.number().describe("Latitude coordinate"),
      longitude: z.number().describe("Longitude coordinate"),
    },
    async ({ latitude, longitude }) => {
      const result = await handleReverseGeocode(latitude, longitude);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "maps_search_places",
    "Search for places using Google Places API",
    {
      query: z.string().describe("Search query"),
      location: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional().describe("Optional center point for the search"),
      radius: z.number().optional().describe("Search radius in meters (max 50000)"),
    },
    async ({ query, location, radius }) => {
      const result = await handlePlaceSearch(query, location, radius);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "maps_place_details",
    "Get detailed information about a specific place",
    {
      place_id: z.string().describe("The place ID to get details for"),
    },
    async ({ place_id }) => {
      const result = await handlePlaceDetails(place_id);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "maps_distance_matrix",
    "Calculate travel distance and time for multiple origins and destinations",
    {
      origins: z.array(z.string()).describe("Array of origin addresses or coordinates"),
      destinations: z.array(z.string()).describe("Array of destination addresses or coordinates"),
      mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional().describe("Travel mode"),
    },
    async ({ origins, destinations, mode }) => {
      const result = await handleDistanceMatrix(origins, destinations, mode);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "maps_elevation",
    "Get elevation data for locations on the earth",
    {
      locations: z.array(z.object({
        latitude: z.number(),
        longitude: z.number(),
      })).describe("Array of locations to get elevation for"),
    },
    async ({ locations }) => {
      const result = await handleElevation(locations);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "maps_directions",
    "Get directions between two points",
    {
      origin: z.string().describe("Starting point address or coordinates"),
      destination: z.string().describe("Ending point address or coordinates"),
      mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional().describe("Travel mode"),
    },
    async ({ origin, destination, mode }) => {
      const result = await handleDirections(origin, destination, mode);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  return server.server;
}
