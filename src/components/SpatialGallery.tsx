import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Group,
  PlaneGeometry,
  CanvasTexture,
  MathUtils,
  OrthographicCamera,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import type { Album, AlbumPosition, View } from "../types";
import { useThumbnail } from "../lib/thumbnails";

const photoPlane = new PlaneGeometry();
function CameraRig({
  view,
  fit,
  label,
}: {
  view: View;
  fit: number;
  label: RefObject<HTMLButtonElement | null>;
}) {
  const { camera, invalidate, size } = useThree();
  const destination = useRef({ ...view, zoom: Math.exp(view.logZoom) * fit });
  const initialized = useRef(false);
  useLayoutEffect(() => {
    destination.current = { ...view, zoom: Math.exp(view.logZoom) * fit };
    if (!initialized.current) {
      camera.position.set(view.x, view.y, 1400);
      (camera as OrthographicCamera).zoom = destination.current.zoom;
      (camera as OrthographicCamera).updateProjectionMatrix();
      initialized.current = true;
    }
    invalidate();
  }, [camera, invalidate, view, fit]);
  useFrame((_, delta) => {
    const target = destination.current;
    const current = camera as OrthographicCamera;
    const damping = 1 - Math.exp(-30 * Math.min(delta, 0.05));
    current.position.x = MathUtils.lerp(current.position.x, target.x, damping);
    current.position.y = MathUtils.lerp(current.position.y, target.y, damping);
    current.zoom = Math.exp(
      MathUtils.lerp(Math.log(current.zoom), Math.log(target.zoom), damping),
    );
    const error =
      Math.abs(current.position.x - target.x) * current.zoom +
      Math.abs(current.position.y - target.y) * current.zoom +
      Math.abs(Math.log(current.zoom / target.zoom)) * 100;
    if (error < 0.05) {
      current.position.x = target.x;
      current.position.y = target.y;
      current.zoom = target.zoom;
    } else invalidate();
    current.updateProjectionMatrix();
    if (label.current) {
      label.current.style.left = `${size.width / 2 - current.position.x * current.zoom}px`;
      label.current.style.top = `${size.height / 2 + (current.position.y - 165) * current.zoom - 14}px`;
    }
  });
  return null;
}
const PhotoStack = memo(function PhotoStack({
  album,
  target,
  selected,
  select,
  open,
  shadow,
}: {
  shadow: Texture;
  album: Album;
  target: AlbumPosition;
  selected: boolean;
  select: (id: string) => void;
  open: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const initial = useRef(target).current;
  const thumbnail = useThumbnail(album.photos[0]);
  const [texture, setTexture] = useState<Texture | null>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    if (!thumbnail) return;
    let active = true;
    const loaded = new TextureLoader().load(thumbnail.url, (value) => {
      value.colorSpace = SRGBColorSpace;
      if (active) {
        setTexture(value);
        invalidate();
      }
    });
    return () => {
      active = false;
      loaded.dispose();
    };
  }, [thumbnail, invalidate]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const object = group.current;
    const damping = 1 - Math.exp(-12 * Math.min(delta, 0.05));
    object.position.x = MathUtils.lerp(object.position.x, target.x, damping);
    object.position.y = MathUtils.lerp(object.position.y, target.y, damping);
    object.position.z = MathUtils.lerp(object.position.z, target.z, damping);
    object.rotation.z = MathUtils.lerp(
      object.rotation.z,
      target.rotation,
      damping,
    );
    object.scale.x = MathUtils.lerp(object.scale.x, target.width, damping);
    object.scale.y = MathUtils.lerp(object.scale.y, target.height, damping);
    if (
      Math.abs(object.position.x - target.x) +
        Math.abs(object.position.y - target.y) +
        Math.abs(object.scale.x - target.width) +
        Math.abs(object.scale.y - target.height) +
        Math.abs(object.position.z - target.z) +
        Math.abs(object.rotation.z - target.rotation) >
      0.05
    )
      invalidate();
  });
  useEffect(() => {
    invalidate();
  }, [target, invalidate]);
  // Fit photos without stretching. Selection has a stable layout box for clearance.
  const aspect = thumbnail?.aspect || 1.48;
  const boxAspect = target.width / target.height;
  const width = aspect < boxAspect ? aspect / boxAspect : 1;
  const height = aspect > boxAspect ? boxAspect / aspect : 1;
  const sheets = Math.min(album.photos.length - 1, selected ? 3 : 2);
  return (
    <group
      ref={group}
      position={[initial.x, initial.y, initial.z]}
      scale={[initial.width, initial.height, 1]}
      rotation={[0, 0, initial.rotation]}
    >
      <mesh
        position={[0.025, -0.06, -8]}
        scale={[width * 1.45, height * 1.5, 1]}
      >
        <primitive object={photoPlane} attach="geometry" />
        <meshBasicMaterial
          map={shadow}
          transparent
          opacity={selected ? 0.65 : 0.45}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: sheets }, (_, i) => sheets - i).map((index) => (
        <group
          key={index}
          position={[index * 0.018, index * 0.042, -index * 1.5]}
          rotation={[0, 0, index * 0.025]}
        >
          <mesh scale={[width + 0.015, height + 0.018, 1]}>
            <primitive object={photoPlane} attach="geometry" />
            <meshBasicMaterial color="#eeece8" />
          </mesh>
          {texture && selected ? (
            <mesh position={[0, 0, 0.1]} scale={[width, height, 1]}>
              <primitive object={photoPlane} attach="geometry" />
              <meshBasicMaterial
                map={texture}
                color="#cbd1d7"
                toneMapped={false}
              />
            </mesh>
          ) : null}
        </group>
      ))}
      <mesh scale={[width + 0.014, height + 0.018, 1]}>
        <primitive object={photoPlane} attach="geometry" />
        <meshBasicMaterial color="#fbfaf7" />
      </mesh>
      <mesh
        position={[0, 0, 0.5]}
        scale={[width, height, 1]}
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta < 5) select(album.id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          open(album.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <primitive object={photoPlane} attach="geometry" />
        <meshBasicMaterial
          key={texture?.uuid || "placeholder"}
          map={texture}
          color={texture ? "#ffffff" : "#b6c5d0"}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
});

function VisibleStacks({
  albums,
  positions,
  selected,
  view,
  fit,
  select,
  open,
  shadow,
}: {
  albums: Album[];
  positions: AlbumPosition[];
  selected: string | null;
  view: View;
  fit: number;
  select: (id: string) => void;
  open: (id: string) => void;
  shadow: Texture;
}) {
  const size = useThree((state) => state.size);
  const zoom = Math.exp(view.logZoom) * fit;
  const halfWidth = size.width / (2 * zoom) + 400;
  const halfHeight = size.height / (2 * zoom) + 400;
  return albums.map((album, index) => {
    const position = positions[index];
    if (
      album.id !== selected &&
      (Math.abs(position.x - view.x) > halfWidth ||
        Math.abs(position.y - view.y) > halfHeight)
    )
      return null;
    return (
      <PhotoStack
        key={album.id}
        shadow={shadow}
        album={album}
        target={position}
        selected={album.id === selected}
        select={select}
        open={open}
      />
    );
  });
}

export default memo(function SpatialGallery({
  albums,
  positions,
  selected,
  view,
  fit,
  select,
  open,
  label,
  paused,
}: {
  label: RefObject<HTMLButtonElement | null>;
  paused: boolean;
  albums: Album[];
  positions: AlbumPosition[];
  selected: string | null;
  view: View;
  fit: number;
  select: (id: string) => void;
  open: (id: string) => void;
}) {
  const shadow = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 8, 32, 32, 32);
    gradient.addColorStop(0, "rgba(20,28,45,.28)");
    gradient.addColorStop(1, "rgba(20,28,45,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => shadow.dispose(), [shadow]);
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1400], near: 0.1, far: 3000 }}
      frameloop={paused ? "never" : "demand"}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      fallback={
        <div className="webgl-fallback">
          此设备暂不支持空间渲染，请尝试更新浏览器或开启图形加速。
        </div>
      }
    >
      <CameraRig view={view} fit={fit} label={label} />
      <VisibleStacks
        albums={albums}
        positions={positions}
        selected={selected}
        view={view}
        fit={fit}
        select={select}
        open={open}
        shadow={shadow}
      />
    </Canvas>
  );
});
