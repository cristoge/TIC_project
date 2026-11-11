// The side menu comes from react-native-drawer-layout, whose native view animates with Reanimated;
// Reanimated cannot start under Jest. This stand-in shows the menu while it is open and the screen
// always, which is what tests need.
jest.mock("react-native-drawer-layout", () => {
  const { createContext, createElement } = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  function Drawer({
    open,
    renderDrawerContent,
    children,
  }: {
    open: boolean;
    renderDrawerContent: () => import("react").ReactNode;
    children: import("react").ReactNode;
  }) {
    return createElement(
      View,
      { style: { flex: 1 } },
      open ? renderDrawerContent() : null,
      children,
    );
  }

  return {
    Drawer,
    DrawerProgressContext: createContext(undefined),
    DrawerGestureContext: createContext(undefined),
    useDrawerProgress: () => ({ value: 0 }),
  };
});
