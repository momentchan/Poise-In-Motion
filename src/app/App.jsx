import { CameraControls } from "@react-three/drei";
import { Canvas } from '@react-three/fiber'
import Head from './Head'
import AccumulatedBloomTrailEffect from "../component/AccumulatedBloomTrailEffect";
import { Suspense } from "react";
import Model from "./Model";
import { Environment } from "@react-three/drei";

export default function App() {
    return <>
        <Canvas
            shadows
            camera={{
                fov: 45,
                near: 0.1,
                far: 200,
                position: [0, 0, 6]
            }}
        >
            <color attach="background" args={['#222222']} />
            <CameraControls makeDefault />
            {/* <ambientLight intensity={0.5} /> */}
            <directionalLight position={[1, 1, 1]} intensity={10} />

            <Environment preset="city" />
            <Suspense fallback={null}>
                {/* <Model path="Samba Dancing.fbx" scale={1} /> */}
                <Model path="Beta Ballet2_Smooth.fbx" scale={0.01} />
            </Suspense>
            <AccumulatedBloomTrailEffect />
            {/* <Utilities /> */}
        </Canvas>
    </>
}