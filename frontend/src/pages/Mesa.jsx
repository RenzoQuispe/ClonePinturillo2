import Header from "../components/Header";
import Footer from "../components/Footer";
import React, { useEffect, useState, useRef } from "react";
import socket from "../libs/socket";
import OpcionesPalabras from "../components/OpcionesPalabras";
import { Send } from "lucide-react";

function Mesa({ setCodigoMesa, setNumMesa, setUsername, setCurrentPage, username, numMesa, codigoMesa }) {

    // Lista de Jugadores
    const [jugadores, setJugadores] = useState([]);
    const [ranking, setRanking] = useState([]);
    // Chat
    const [mensajes, setMensajes] = useState([]);
    const [mensajeActual, setMensajeActual] = useState("");
    const messagesEndRef = useRef(null);
    useEffect(() => { // scroll automatico
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mensajes]);
    // Turnos
    const [turno, setTurno] = useState();
    const [indiceTurno, setIndiceTurno] = useState(0);
    // Opciones palabras
    const [opcionesPalabras, setOpcionesPalabras] = useState([]);
    // escuchamos el evento opciones_palabras
    useEffect(() => {
        const handleOpcionesPalabras = (palabras) => {
            console.log("Opciones recibidas:", palabras);
            setOpcionesPalabras(palabras);
        };
        socket.on("opciones_palabras", handleOpcionesPalabras);
        return () => {
            socket.off("opciones_palabras", handleOpcionesPalabras);
        };
    }, []);
    // emitir palabra escogida
    const escogerPalabra = (palabra) => {
        socket.emit("palabra_escogida", { mesaId: numMesa, palabra });
        setOpcionesPalabras([]); // Ocultar opciones tras escoger
    };
    // Jugador actual en turno
    useEffect(() => {
        if (jugadores.length > 0) {
            setTurno(jugadores[indiceTurno]);
        }
    }, [indiceTurno, jugadores]);

    // Regresar al menú principal
    const handleMenu = () => {
        setUsername("");
        setCodigoMesa("");
        setNumMesa("");
        setCurrentPage("home");
    };

    // Verifica si la sala existe (al entrar o reconectar)
    useEffect(() => {
        if (numMesa) {
            socket.emit("verificar_sala", numMesa);
        }
        const handleReconnect = () => {
            if (numMesa) {
                socket.emit("verificar_sala", numMesa);
            }
        };
        socket.on("connect", handleReconnect);
        return () => {
            socket.off("connect", handleReconnect);
        };
    }, [numMesa]);

    // Maneja si la sala fue eliminada (respuesta del servidor)
    useEffect(() => {
        const handleSalaEliminada = () => {
            alert("La sala ha sido eliminada o ya no está disponible.");
            handleMenu();
        };
        socket.on("sala_eliminada", handleSalaEliminada);
        return () => {
            socket.off("sala_eliminada", handleSalaEliminada);
        };
    }, []);

    //  Para recibir la lista de jugadores desde el servidor
    useEffect(() => {
        const handleActualizarJugadores = (jugadores) => {
            setJugadores(jugadores);
        };
        socket.on("actualizar_jugadores", handleActualizarJugadores);
        return () => {
            socket.off("actualizar_jugadores", handleActualizarJugadores);
        };
    }, []);
    useEffect(() => {
        if (numMesa) {
            socket.emit("solicitar_jugadores", numMesa);
        }
    }, [numMesa]);

    // para recibir mensajes desde el servidor
    useEffect(() => {
        socket.on("nuevo_mensaje", (mensaje) => {
            setMensajes(prev => [...prev, mensaje]);
        });

        return () => {
            socket.off("nuevo_mensaje");
        };
    }, []);
    const enviarMensaje = (mensaje) => {
        if (mensajeActual.trim() !== "") {
            const nuevoMensaje = { username, texto: mensajeActual };
            socket.emit("enviar_mensaje", { numMesa, mensaje: nuevoMensaje });
            socket.emit("actualizar_puntos", {
                mesaId: numMesa,
                puntosGanados: contadorTurno,
                intentoAdivinar: mensaje,
            });
            setMensajeActual("");
        }
    };
    //contador turnos
    const [contadorTurno, setContadorTurno] = useState(10);
    useEffect(() => {
        const handleEstadoTurno = ({ turno, contador }) => {
            setTurno(turno);
            setContadorTurno(contador);
        };
        socket.on("estado_turno", handleEstadoTurno);
        return () => {
            socket.off("estado_turno", handleEstadoTurno);
        };
    }, []);
    // Rondas y fin de la partida
    const [ronda, setRonda] = useState(1);
    const [finPartida, setFinPartida] = useState(false);
    const [contadorReinicio, setContadorReinicio] = useState(10);
    const intervaloReinicio = useRef(null);
    useEffect(() => {
        const handleEstadoTurno = ({ turno, contador, ronda }) => {
            setTurno(turno);
            setContadorTurno(contador);
            setRonda(ronda);
        };
        socket.on("estado_turno", handleEstadoTurno);

        const handleFinPartida = ({ ranking }) => {
            setRanking(ranking);
            setFinPartida(true);
            setMensajes([]);
            // para la el componente tabla final
            setContadorReinicio(10)
            if (intervaloReinicio.current) {
                clearInterval(intervaloReinicio.current);
            }
            intervaloReinicio.current = setInterval(() => {
                setContadorReinicio((prev) => {
                    if (prev <= 1) {
                        clearInterval(intervaloReinicio.current);
                        intervaloReinicio.current = null;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            setTimeout(() => {
                setFinPartida(false);
                setMensajes([]);
            }, 10000);
        };
        socket.on("fin_partida", handleFinPartida);
        return () => {
            socket.off("estado_turno", handleEstadoTurno);
            socket.off("fin_partida", handleFinPartida);
            if (intervaloReinicio.current) {
                clearInterval(intervaloReinicio.current);
            }
        };
    }, []);

    return (
        <div style={{ backgroundColor: '#336767', height: '100dvh' }} className="overflow-auto flex flex-col items-center">
            <Header />
            <div className="flex justify-between space-x-5 mt-3 mb-3">
                {/* Tabla de jugadores */}
                <div style={{ border: "5px solid #a09c34" }} className="bg-gray-200 rounded-3xl h-[625px] w-[200px] text-black p-2 overflow-y-auto">
                    <ul>
                        {jugadores.length > 0 ? (
                            jugadores
                                .slice() // copia para no mutar el state
                                .sort((a, b) => b.puntos - a.puntos)
                                .map((jugador, index) => {
                                    const esTurno = turno && turno.id === jugador.id;
                                    return (
                                        <div
                                            key={jugador.id}
                                            className={`flex space-x-1 h-[65px]  text-lg ${esTurno ? "font-bold" : ""}`}
                                            style={{ color: esTurno ? "red" : "gray", borderBottom: "1px solid #bbb5b4" }}
                                        >
                                            <div className=" font-bold text-6xl">
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h1 className="text-2xl text-black font-bold">{jugador.puntos}</h1>
                                                <h2 className="text-2xl font-bold">{jugador.username}</h2>
                                            </div>
                                            {
                                                esTurno
                                                    ? <img src="/Lapiz.png" className="ml-auto w-8" alt="Lápiz" />
                                                    : <img src="/siluetaLapiz.png" className="ml-auto w-8" alt="Silueta Lápiz" />
                                            }
                                        </div>
                                    );
                                })
                        ) : (
                            <li className="text-lg">No hay jugadores en esta sala.</li>
                        )}
                    </ul>
                </div>
                {/* Componente del medio */}
                <div>
                    {/* Encabezado*/}
                    <div style={{ background: "#d03434" }} className="flex space-x-1 rounded-tl-3xl rounded-tr-3xl h-[80px] w-[600px]">
                        <div className="border-5 rounded-full w-[70px] h-[65px] bg-gray-200 text-5xl text-center font-bold ml-3 mt-2">{contadorTurno}</div>
                        <div className="ml-3 mt-2">
                            <div className="text-2xl font-bold">MESA N° {numMesa} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; RONDA {ronda}/3</div>
                            <div style={{ background: "#c03434" }} className="rounded-tl-2xl rounded-tr-2xl h-[40px] w-[410px] flex items-center justify-center">
                                {/* Mostrar palabra actual SOLO si es su turno */}
                                {turno?.id === socket.id && turno?.palabra && (
                                    <span className="font-bold text-3xl">
                                        {turno.palabra}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Campo de Dibujo */}
                    <div style={{ border: "5px solid #a09c34", background: "#FFFFFF" }} className="rounded-bl-3xl rounded-br-3xl h-[545px] w-[600px] text-black">
                        {/* 
                        CÓDIGO: {codigoMesa} <br />
                        <div className=" text-lg">
                            {turno ? `Turno de ${turno.username}` : "Esperando jugadores..."}
                        </div>
                        */}
                        {turno?.id === socket.id && opcionesPalabras.length > 0 && (
                            <OpcionesPalabras opciones={opcionesPalabras} onEscoger={escogerPalabra} />
                        )}
                        {finPartida && (
                            <div className="bg-black p-6 rounded-lg shadow-xl text-center">
                                <h2 className="text-2xl font-bold mb-4">Partida finalizada</h2>
                                {/* Mostrar ganadores */}
                                {ranking.length > 0 && (
                                    <>
                                        <p className="mt-2 font-semibold text-lg">Ganador{ranking.filter(j => j.puntos === ranking[0].puntos).length > 1 ? 'es' : ''}:</p>
                                        <ul className="mb-4">
                                            {ranking
                                                .filter(j => j.puntos === ranking[0].puntos)
                                                .map((j, i) => (
                                                    <li key={i} className="text-white font-bold">
                                                        🏆 {j.username} - {j.puntos} puntos
                                                    </li>
                                                ))}
                                        </ul>
                                    </>
                                )}
                                {/* Mostrar tabla completa */}
                                <p>Tabla final de puntos</p>
                                <ul>
                                    {ranking.map((j, i) => (
                                        <li key={i}>
                                            {i + 1}. {j.username} - {j.puntos}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-4 text-sm text-gray-300">Reiniciando partida en {contadorReinicio} segundos.</p>
                            </div>
                        )}
                    </div>
                </div>
                {/* Chat */}
                <div style={{ border: "5px solid #a09c34" }} className="bg-gray-200 rounded-3xl h-[625px] w-[400px] text-black p-2 flex flex-col justify-between">
                    <div className="overflow-y-auto flex-1 text-black">
                        <ul className="space-y-1 text-black">
                            {mensajes.map((msg, idx) => {
                                const jugador = jugadores.find(j => j.username === msg.username);
                                const color = jugador ? jugador.color : "#000000";
                                return (
                                    <li key={idx} className="text-2xl">
                                        <span className="font-bold" style={{ color }}>
                                            {msg.username}:
                                        </span>{" "}
                                        {msg.texto}
                                    </li>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </ul>
                    </div>
                    <div className="mt-2 flex">
                        <input
                            value={mensajeActual}
                            onChange={(e) => setMensajeActual(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && enviarMensaje(mensajeActual)}
                            className="flex-1 p-1 ml-1 rounded-sm text-black border bg-gray-300"
                        />
                        <button
                            onClick={() => enviarMensaje(mensajeActual)}
                            style={{ background: "#336767" }}
                            className="ml-2 px-2 w-[38px] text-white font-bold rounded-sm hover:brightness-110"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>

            </div>
            <Footer />
        </div>
    );
}

export default Mesa;
