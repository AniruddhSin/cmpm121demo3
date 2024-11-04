// todo
import "./style.css";
const _app: HTMLDivElement = document.querySelector("#app")!;

const tempButton = document.createElement("button");
tempButton.innerText = "Click Me!";
tempButton.addEventListener("click", () => {
  console.log("the button was clicked!");
});
_app.append(tempButton);
