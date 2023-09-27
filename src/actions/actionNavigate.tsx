import {getClientColor} from "../clients";
import {Avatar} from "../components/Avatar";
import {centerScrollOn} from "../scene/scroll";
import {Collaborator} from "../types";
import {register} from "./register";
import {useEffect} from "react";

function difference(num1: number, num2: number) {
  if(num1 > num2) {
    return Math.abs(num2 - num1)
  } else {
    return Math.abs(num1 - num2)
  }
}
export const actionGoToCollaborator = register({
  name: "goToCollaborator",
  viewMode: true,
  trackEvent: {category: "collab"},
  perform: (_elements, appState, value) => {
    const [collaboratorPoint, beingTracked] = value as [Collaborator["pointer"], boolean];
    if (!collaboratorPoint) {
      return {appState, commitToHistory: false};
    }

    const xPad= appState.width / 3 / appState.zoom.value
    const yPad= appState.height / 3 / appState.zoom.value
    const newScroll = centerScrollOn({
      scenePoint: collaboratorPoint,
      viewportDimensions: {
        width: appState.width,
        height: appState.height,
      },
      zoom: appState.zoom,
    })

    const yDiff = difference(newScroll.scrollY, appState.scrollY);
    const xDiff = difference(newScroll.scrollX, appState.scrollX);
    const outsideBounds = yDiff > yPad || xDiff > xPad;

    if (beingTracked && !outsideBounds) return {
      appState, commitToHistory: false
    };
    return {
      appState: {
        ...appState,
        ...centerScrollOn({
          scenePoint: collaboratorPoint,
          viewportDimensions: {
            width: appState.width,
            height: appState.height,
          },
          zoom: appState.zoom,
        }),
        // Close mobile menu
        openMenu: appState.openMenu === "canvas" ? null : appState.openMenu,
      },
      commitToHistory: false,
    };
  },
  PanelComponent: ({updateData, data}) => {
    const [clientId, collaborator, [trackingClientId, setTrackingClientId]] = data as [string, Collaborator, any];
    const background = getClientColor(clientId);

    const beingTracked = trackingClientId === clientId;

    useEffect(() => {
      if (beingTracked) {
        const id = setInterval(() => {
          updateData([collaborator.pointer, beingTracked])
        }, 1000)
        return () => {
          clearInterval(id);
        }
      }
    }, [beingTracked])

    function doubleClickHandler() {
      setTrackingClientId((x: any) => x === clientId ? '' : clientId);
    }

    return (
      <Avatar
        tracking={beingTracked}
        color={background}
        onClick={() => updateData([collaborator.pointer, false])}
        onDoubleClick={doubleClickHandler}
        name={collaborator.username || ""}
        src={collaborator.avatarUrl}
      />
    );
  },
});
