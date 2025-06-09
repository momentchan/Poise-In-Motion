import { CameraControls } from "@react-three/drei";
import { Canvas } from '@react-three/fiber'
import Model from './Model'
import PingPongEffect from "../component/PingPongEffect";
import { Suspense } from "react";

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
            <color attach="background" args={['#ffffff']} />
            <CameraControls makeDefault />
            <Suspense fallback={null}>
            <Model />
            </Suspense>
            <PingPongEffect />
            {/* <Utilities /> */}
        </Canvas>
    </>
}