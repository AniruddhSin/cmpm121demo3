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

// Set up types/interfaces
type GridPoint = {
  i: number;
  j: number;
};
interface Coin {
  cell: GridPoint;
  serial: string;
}
interface Cache {
  coins: Coin[];
}
const allCaches: Map<GridPoint, Cache> = new Map();

// Set up Event Bus to handle dispatched Events
const bus = new EventTarget();
/* Possible Event Names:
player_moved
inventory_changed
*/
function notifyBus(eventName: string) {
  bus.dispatchEvent(new Event(eventName));
}
bus.addEventListener("inventory_changed", updateInventory);

const title = document.getElementById("title")!;
title.innerText = "NFT Colletion";

// Tunable gameplay parameters
const SPAWN_POINT = leaflet.latLng(0, 0);
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
const collectedCoins: Coin[] = [];
const inventory = document.getElementById("inventory")!; // element `inventory` is defined in index.html
inventory.innerHTML = "No coins";

function updateInventory() {
  inventory.innerHTML = "";
  const ul = document.createElement("ul"); // start the unordered list of NFTs
  collectedCoins.forEach((coin: Coin) => { // coins have a cell and serial
    const li = document.createElement("li");
    li.textContent = `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;
    ul.appendChild(li);
  });
  inventory.append(ul);
}

// Set up collection and depositing of coins
// collection/depositing of coins will be randomized to add a twist to the nature of the game
function collect(cell: GridPoint) {
  const collectCache = allCaches.get(cell);
  if (collectCache && collectCache.coins.length > 0) {
    const whichCoin: number = Math.floor(
      Math.random() * collectCache.coins.length,
    );
    const coin: Coin = collectCache.coins.splice(whichCoin, 1).pop()!;
    collectedCoins.push(coin);
    notifyBus("inventory_changed");
  }
}
function deposit(cell: GridPoint) {
  const depositCache = allCaches.get(cell);
  if (depositCache && collectedCoins.length > 0) {
    const whichCoin: number = Math.floor(Math.random() * collectedCoins.length);
    const coin: Coin = collectedCoins.splice(whichCoin, 1).pop()!;
    depositCache.coins.push(coin);
    notifyBus("inventory_changed");
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
    coins: [],
  };
  // Populate the cache
  for (
    let i = 0;
    i < Math.floor(luck([point.i, point.j, "initialValue"].toString()) * 8);
    i++
  ) {
    cache.coins.push({
      cell: point,
      serial: i.toString(),
    });
  }
  allCaches.set(point, cache);
  // Handle interactions with the cache
  rect.bindPopup(() => {
    // The popup offers a description and button
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>Cache "${point.i}:${point.j}". It has <span id="value">${cache.coins.length}</span> coins.</div>
                <button id="collect">collect</button>
                <button id="deposit">deposit</button>`;

    // Clicking the button decrements the cache's value and increments the player's points
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        collect(point);
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .coins.length.toString();
      });
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        deposit(point);
        popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
          .coins.length.toString();
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
