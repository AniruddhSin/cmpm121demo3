import "./style.css";
import leaflet from "leaflet";
// CSS Files
import "leaflet/dist/leaflet.css";
import "./style.css";
// Workaround file
import "./leafletWorkaround.ts";
// Deterministic random number generator
import luck from "./luck.ts";
//import { GridLayer } from "npm:@types/leaflet@^1.9.14";

type GridPoint = {
  i: number;
  j: number;
};
interface Cache {
  coins: number;
}
const allCaches: Map<GridPoint, Cache> = new Map();

const title = document.getElementById("title")!;
title.innerText = "Hello";

// Tunable gameplay parameters
const SPAWN_POINT = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(document.getElementById("map")!, {
  center: SPAWN_POINT,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(SPAWN_POINT);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Set up NFT coins
let collectedCoins = 0;
const NFTPanel = document.getElementById("NFTPanel")!; // element `NFTPanel` is defined in index.html
NFTPanel.innerHTML = "No coins";

// Set up collection and depositing of coins
// this function assumes the cell has a cache in it because it is only called when a cache is collected from
function collect(cell: GridPoint) {
  const collectCache = allCaches.get(cell);
  if (collectCache && collectCache.coins > 0) {
    collectCache.coins -= 1;
    collectedCoins += 1;
  }
}
function deposit(cell: GridPoint) {
  const depositCache = allCaches.get(cell);
  if (depositCache && collectedCoins > 0) {
    depositCache.coins += 1;
    collectedCoins -= 1;
  }
}

// Add caches to a given point on the map
function spawnCache(point: GridPoint) {
  // Convert cell numbers into lat/lng bounds
  const bounds = leaflet.latLngBounds([
    [
      SPAWN_POINT.lat + point.i * TILE_DEGREES,
      SPAWN_POINT.lng + point.j * TILE_DEGREES,
    ],
    [
      SPAWN_POINT.lat + (point.i + 1) * TILE_DEGREES,
      SPAWN_POINT.lng + (point.j + 1) * TILE_DEGREES,
    ],
  ]);
  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  const cache: Cache = {
    coins: Math.floor(
      luck([point.i, point.j, "initialValue"].toString()) * 100,
    ),
  };
  allCaches.set(point, cache);
  // Handle interactions with the cache
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>There is a cache here at "${point.i},${point.j}". It has value <span id="value">${cache.coins}</span>.</div>
                <button id="collect">collect</button>
                <button id="deposit">deposit</button>`;

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        collect(point);
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .coins.toString();
        NFTPanel.innerHTML = `${collectedCoins} coins accumulated`;
      });
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        deposit(point);
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .coins.toString();
        NFTPanel.innerHTML = `${collectedCoins} coins accumulated`;
      });

    return popupDiv;
  });
}

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache({ i, j });
    }
  }
}
