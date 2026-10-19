import { act, render, screen } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";

import { createViroArScene, type ViroApi } from "./ViroArScene";
import { rotateByHeading } from "@/domain/arScene";

function makeViro() {
  const createMaterials = jest.fn();
  let tracking: ((state: number, reason: number) => void) | undefined;
  const viro: ViroApi = {
    ViroARSceneNavigator: ({ initialScene }: any) => {
      const S = initialScene.scene;
      return <S />;
    },
    ViroARScene: ({ onTrackingUpdated, children }: any) => {
      tracking = onTrackingUpdated;
      return <View testID="scene">{children}</View>;
    },
    ViroSphere: (p: any) => <View testID="sphere" {...p} />,
    ViroMaterials: { createMaterials },
    ViroTrackingStateConstants: {
      TRACKING_UNAVAILABLE: 1,
      TRACKING_LIMITED: 2,
      TRACKING_NORMAL: 3,
    },
  } as any;
  return {
    viro,
    createMaterials,
    track: (s: number, r = 0) => tracking?.(s, r),
  };
}

const place = (id: string, over: Record<string, unknown> = {}) => ({
  placeId: id,
  eastMeters: 0,
  northMeters: 0,
  distanceMeters: 10,
  bearingDegrees: 0,
  sceneX: 3,
  sceneZ: -4,
  auraRadius: 2,
  auraOpacity: 0.3,
  visibleOrbCount: 3,
  name: id,
  color: "#ff0000",
  memoryIds: ["m1", "m2", "m3", "m4"],
  ...over,
});

const setup = (props: Record<string, unknown> = {}) => {
  const f = makeViro();
  const Scene = createViroArScene(f.viro);
  const handlers = {
    onPressPlace: jest.fn(),
    onPressOrb: jest.fn(),
    onTrackingError: jest.fn(),
  };
  const el = (extra: Record<string, unknown> = {}) => (
    <Scene
      places={[
        place("a"),
        place("b", { color: "#00ff00", visibleOrbCount: 0 }),
      ]}
      heading={90}
      {...handlers}
      {...props}
      {...extra}
    />
  );
  return { ...f, ...handlers, el };
};

describe("ViroArScene", () => {
  afterEach(() => jest.useRealTimers());

  it("renders an aura per place plus capped orbs", async () => {
    const { el } = setup();
    await render(el());
    // a: 1 aura + 3 orbs, b: 1 aura + 0 orbs
    expect(screen.getAllByTestId("sphere")).toHaveLength(5);
  });

  it("caps orbs by memory count", async () => {
    const { el } = setup();
    await render(
      el({
        places: [place("a", { visibleOrbCount: 9, memoryIds: ["m1", "m2"] })],
      }),
    );
    expect(screen.getAllByTestId("sphere")).toHaveLength(3);
  });

  it("positions the aura using the heading at mount only", async () => {
    const { el } = setup();
    const r = await render(
      el({ places: [place("a", { visibleOrbCount: 0 })] }),
    );
    const expected = rotateByHeading({ sceneX: 3, sceneZ: -4 }, 90);
    const aura = screen.getAllByTestId("sphere")[0];
    expect(aura.props.position[0]).toBeCloseTo(expected.x);
    expect(aura.props.position[1]).toBe(-1);
    expect(aura.props.position[2]).toBeCloseTo(expected.z);
    expect(aura.props.radius).toBe(2);
    expect(aura.props.opacity).toBe(0.3);
    await r.rerender(
      el({ heading: 200, places: [place("a", { visibleOrbCount: 0 })] }),
    );
    const again = screen.getAllByTestId("sphere")[0];
    expect(again.props.position[0]).toBeCloseTo(expected.x);
    expect(again.props.position[2]).toBeCloseTo(expected.z);
  });

  it("places orbs on a ring around the aura at the same height", async () => {
    const { el } = setup();
    await render(el({ places: [place("a", { visibleOrbCount: 4 })] }));
    const [aura, ...orbs] = screen.getAllByTestId("sphere");
    expect(orbs).toHaveLength(4);
    for (const o of orbs) {
      expect(o.props.radius).toBeCloseTo(0.15);
      expect(o.props.position[1]).toBe(-1);
      const d = Math.hypot(
        o.props.position[0] - aura.props.position[0],
        o.props.position[2] - aura.props.position[2],
      );
      expect(d).toBeCloseTo(2.6);
    }
  });

  it("routes presses", async () => {
    const { el, onPressPlace, onPressOrb } = setup();
    await render(el());
    const spheres = screen.getAllByTestId("sphere");
    await act(async () => {
      spheres[0].props.onClick();
    });
    expect(onPressPlace).toHaveBeenCalledWith("a");
    await act(async () => {
      spheres[2].props.onClick();
    });
    expect(onPressOrb).toHaveBeenCalledWith("m2");
  });

  it("creates one material per distinct colour", async () => {
    const { el, createMaterials } = setup();
    const r = await render(el());
    await r.rerender(el());
    const names = createMaterials.mock.calls.flatMap((c) => Object.keys(c[0]));
    expect(new Set(names).size).toBe(names.length);
    expect(names).toHaveLength(3); // 2 aura colours + orb material
  });

  it("reports tracking error once on UNAVAILABLE", async () => {
    const { el, track, onTrackingError } = setup();
    await render(el());
    await act(async () => {
      track(3);
    });
    expect(onTrackingError).not.toHaveBeenCalled();
    await act(async () => {
      track(1, 1);
    });
    await act(async () => {
      track(1, 1);
    });
    expect(onTrackingError).toHaveBeenCalledTimes(1);
  });

  it("reports tracking error when NORMAL is not reached in time, not when it is", async () => {
    jest.useFakeTimers();
    const a = setup();
    await render(a.el());
    await act(async () => {
      a.track(2, 2);
    });
    await act(async () => {
      jest.advanceTimersByTime(6000);
    });
    expect(a.onTrackingError).toHaveBeenCalledTimes(1);

    const b = setup();
    await render(b.el());
    await act(async () => {
      b.track(2, 2);
    });
    await act(async () => {
      b.track(3);
    });
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(b.onTrackingError).not.toHaveBeenCalled();
  });
});
