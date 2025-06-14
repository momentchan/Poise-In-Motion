import { CameraControls } from "@react-three/drei";
import { Canvas } from '@react-three/fiber'
import Head from './Head'
import PingPongEffect from "../component/PingPongEffect";
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
            <Suspense fallback={null}>
                {/* <ambientLight intensity={0.5} /> */}
                <directionalLight position={[1, 1, 1]} intensity={1} />

                <Environment preset="city" />
                <Model path="Samba Dancing.fbx" />
            </Suspense>
            <PingPongEffect />
            {/* <Utilities /> */}
        </Canvas>
    </>
}