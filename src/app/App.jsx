import { CameraControls } from "@react-three/drei";
import { Canvas } from '@react-three/fiber'
import Head from './Head'
import AccumulatedBloomTrailEffect from "../component/AccumulatedBloomTrailEffect";
import { Suspense } from "react";
import Model from "./Model";
import { Environment } from "@react-three/drei";
import { Leva } from 'leva';
import { customTheme } from "../r3f-gist/theme/levaTheme.js";
import Lighting from "./Lighting.jsx";

export default function App() {
    return <>
        <Leva theme={customTheme} />

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
            <Lighting helper={false} />

            <Suspense fallback={null}>
                <Model path="ballerina_dance.fbx" scale={0.01} />
            </Suspense>
            <AccumulatedBloomTrailEffect />
            {/* <Utilities /> */}
        </Canvas>
    </>
}