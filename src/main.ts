import "./style.css";
import leaflet, { Polyline } from "leaflet";
// CSS Files
import "leaflet/dist/leaflet.css";
import "./style.css";
// Workaround file
import "./leafletWorkaround.ts";
// Deterministic random number generator
import luck from "./luck.ts";

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
  toMemento(): string;
}
// first string is stringified GridPoint
const availableCaches: Map<string, Cache> = new Map();
const mementoCaches: Map<string, string> = new Map();

// Set up Event Bus to handle dispatched Events
const bus = new EventTarget();
/* Possible Event Names:
inventory_changed
*/
function notifyBus(eventName: string) {
  bus.dispatchEvent(new Event(eventName));
}
bus.addEventListener("inventory_changed", updateInventory);

const title = document.getElementById("title")!;
title.innerText = "NFT Colletion";

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
const playerLocation = SPAWN_POINT;
const playerMarker = leaflet.marker(playerLocation);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Set up movement history
const movementHistory: Polyline = leaflet.polyline([]).addTo(map);
movementHistory.addLatLng(leaflet.latLng(SPAWN_POINT.lat, SPAWN_POINT.lng));

// Set up rectangle group to help redrawing
const rectGroup = leaflet.layerGroup().addTo(map);

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
  const collectCache = availableCaches.get(JSON.stringify(cell));
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
  const depositCache = availableCaches.get(JSON.stringify(cell));
  if (depositCache && collectedCoins.length > 0) {
    const whichCoin: number = Math.floor(Math.random() * collectedCoins.length);
    const coin: Coin = collectedCoins.splice(whichCoin, 1).pop()!;
    depositCache.coins.push(coin);
    notifyBus("inventory_changed");
  }
}

// Add caches to a given point on the map ; point is a global point, not grid location
function spawnCache(point: GridPoint) {
  // Convert cell numbers into lat/lng bounds
  const bounds = leaflet.latLngBounds([
    [
      point.i * TILE_DEGREES,
      point.j * TILE_DEGREES,
    ],
    [
      (point.i + 1) * TILE_DEGREES,
      (point.j + 1) * TILE_DEGREES,
    ],
  ]);
  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds);
  rect.addTo(rectGroup);

  // create new cache if not in mementoCaches
  // if in memento caches, take it away from memento
  let cache: Cache;
  if (
    mementoCaches.has(
      JSON.stringify(point),
    )
  ) {
    cache = {
      coins: JSON.parse(
        mementoCaches.get(
          JSON.stringify(point),
        )!,
      ),
      toMemento() {
        return JSON.stringify(this.coins);
      },
    };
    mementoCaches.delete(
      JSON.stringify(point),
    );
  } else {
    cache = {
      coins: [],
      toMemento() {
        return JSON.stringify(this.coins);
      },
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
  }
  availableCaches.set(
    JSON.stringify(point),
    cache,
  );
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

// Set up movement keys
// While this could have been done using a Command pattern, future updates will not require more usability
// so it is being hard coded
function movePlayer(lat: number, lng: number) {
  const newLat = playerLocation.lat + lat * TILE_DEGREES;
  const newLng = playerLocation.lng + lng * TILE_DEGREES;
  playerLocation.lat = newLat;
  playerLocation.lng = newLng;
  playerMarker.setLatLng(playerLocation);
  movementHistory.addLatLng(leaflet.latLng(newLat, newLng));
  map.panTo(playerLocation);
  updateLocation();
}
const northButton = document.getElementById("north");
northButton!.addEventListener("click", () => {
  movePlayer(1, 0);
});
const eastButton = document.getElementById("east");
eastButton!.addEventListener("click", () => {
  movePlayer(0, 1);
});
const southButton = document.getElementById("south");
southButton!.addEventListener("click", () => {
  movePlayer(-1, 0);
});
const westButton = document.getElementById("west");
westButton!.addEventListener("click", () => {
  movePlayer(0, -1);
});

// Additional buttons
const sensorButton = document.getElementById("sensor");
sensorButton!.addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition((position) => {
    playerLocation.lat = position.coords.latitude;
    playerLocation.lng = position.coords.longitude;
    movePlayer(0, 0);
  });
});

function updateLocation() {
  // memento all the existing caches (if there are any) and delete available caches
  availableCaches.forEach((value, key) => {
    mementoCaches.set(key, value.toMemento());
    availableCaches.delete(key);
  });
  rectGroup.clearLayers();
  // spawn caches but if there is a memento of one, reify it
  const offset = {
    i: Math.floor(playerLocation.lat / TILE_DEGREES),
    j: Math.floor(playerLocation.lng / TILE_DEGREES),
  };
  for (
    let i = offset.i - NEIGHBORHOOD_SIZE;
    i < offset.i + NEIGHBORHOOD_SIZE;
    i++
  ) {
    for (
      let j = offset.j - NEIGHBORHOOD_SIZE;
      j < offset.j + NEIGHBORHOOD_SIZE;
      j++
    ) {
      // If location i,j is lucky enough, spawn a cache!
      if (
        luck([i, j].toString()) <
          CACHE_SPAWN_PROBABILITY
      ) {
        spawnCache({ i, j });
      }
    }
  }
}
updateLocation();
