import * as IPFS from 'ipfs-core'
import { createLibp2p } from 'libp2p'
import { MulticastDNS } from '@libp2p/mdns'
import { KadDHT } from '@libp2p/kad-dht'
import { WebSockets } from '@libp2p/websockets'
import { WebRTCStar } from '@libp2p/webrtc-star'
import { Bootstrap } from '@libp2p/bootstrap'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { GossipSub } from '@chainsafe/libp2p-gossipsub'
import { PubSubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import type { CID } from 'multiformats/cid'
import { TCP } from '@libp2p/tcp'
import { PeerId, RSAPeerId } from '@libp2p/interface-peer-id'
import { Message } from '@libp2p/kad-dht/dist/src/message'
import { EventEmitter } from 'events'
import os from 'os'
import path from 'path'
import { nanoid } from 'nanoid'


export interface INodeEvents {
    subscribed: (property: string) => void
    unsubscribed: (property: string) => void
    peerSubscribed:(property: string) => void
    peerUnsubscribed:(property: string) => void
    selectedLeader: (property: string) => void
    sentMessage: (property: string) => void
    receivedMessage: (property: string) => void
    uploadedData: (property: string) => void
    downloadedData: (property: string) => void
}

export class Node extends EventEmitter {

    private _topic: string
    private _node
    private _peerId: PeerId
    private _peers: string[]
    private _untypedOn = this.on
    private _untypedEmit = this.emit
    public on = <K extends keyof INodeEvents>(event: K, listener: INodeEvents[K]): this => this._untypedOn(event, listener)
    public emit = <K extends keyof INodeEvents>(event: K, ...args: Parameters<INodeEvents[K]>): boolean => this._untypedEmit(event, ...args)

    constructor(topic: string) {
        super()

        const libp2pBundle = (opts) => {

            this._peerId = opts.peerId
            const bootstrapList = opts.config.Bootstrap
            const webRTCStar = new WebRTCStar()
        
            return this.configureLibp2p(this._peerId, webRTCStar, bootstrapList)
        }

        this._node =  IPFS.create({
            repo:  path.join(os.tmpdir(), `repo-${nanoid()}`),
            libp2p: libp2pBundle
        })

        this._topic = topic
        this._peers = new Array(0)
    }

    async poll(frequency: number) {
        setInterval(async () => {
            this.checkForNewPeers()
        }, frequency)
    }

    async subscribe(): Promise<void> {
        const node: IPFS.IPFS = await this._node
        const receivedMessage = (message) => this.emit('receivedMessage', String.fromCharCode.apply(null, message.data))
        node.pubsub.subscribe(this._topic,receivedMessage)
        this.emit('subscribed', this._topic)
    }

    async unsubscribe() {
        const node: IPFS.IPFS = await this._node
        node.pubsub.unsubscribe(this._topic)
        this.emit('unsubscribed', this._topic)
    }

    async sendMessage(message: string){
        const node: IPFS.IPFS = await this._node
        node.pubsub.publish(this._topic, new TextEncoder().encode(message))
        this.emit('sentMessage', message)
        return message
    }

    async upload(data: string){
        const node: IPFS.IPFS = await this._node
        const file = await node.add({
            path: this._topic,
            content: new TextEncoder().encode(data)
          })
        const cid = file.cid.toString()
        this.emit('uploadedData', cid)
        return file.cid.toString()
    }

    async download(cid: string){
        const node: IPFS.IPFS = await this._node
        const decoder = new TextDecoder()
        let data = ''
      
        for await (const chunk of node.cat(cid)) {
          data += decoder.decode(chunk, {
            stream: true
          })
        }
        this.emit('downloadedData', data)
        return data
    }

    selectLeader(){
        const newLeader =  'abc123'
        this.emit('selectedLeader', newLeader)
    }

    getPeers(){
        return this._peers
    }

    private async checkForNewPeers(){

        const node: IPFS.IPFS = await this._node
        var prevPeers: string[] = this._peers;
        this._peers = (await node.pubsub.peers(this._topic)).map(String);

        var peersLeft = prevPeers.filter((prevPeer: string) => !prevPeers.includes(prevPeer));
        peersLeft.forEach(peer => this.emit('peerUnsubscribed',peer.toString()));
    
        var peersJoined = this._peers.filter((peer: string) => !prevPeers.includes(peer));
        peersJoined.forEach(peer => this.emit('peerSubscribed',peer.toString()));
      }

    // see https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md
    private configureLibp2p(peerId: any, webRTCStar: WebRTCStar, bootstrapList: any) {
        console.log(bootstrapList)
        return createLibp2p({
            peerId,
            addresses: {
                listen: [
                    '/ip4/0.0.0.0/tcp/0/ws',
                    '/ip4/0.0.0.0/tcp/0',
                    '/ip4/127.0.0.1/tcp/0/ws',
                    '/ip4/127.0.0.1/tcp/0',
                ]
            },
            connectionManager: {
                pollInterval: 5000,
                autoDial: true, // auto dial to peers we find when we dip below min peers
            },
            transports: [
                new WebSockets(),
                new TCP(),
            ],
            streamMuxers: [
                new Mplex()
            ],
            connectionEncryption: [
                new Noise()
            ],
            peerDiscovery: [
                new MulticastDNS({
                    interval: 10000
                  }),
                new Bootstrap({
                    interval: 30e3,
                    list: [bootstrapList]
                }),
                new PubSubPeerDiscovery({
                    interval: 1000
                })
            ],
            //dht: new KadDHT(),
            // Turn on relay with hop active so we can connect to more peers
            relay: {
                enabled: true,
                hop: {
                    enabled: true,
                    active: true
                }
            },
            pubsub: new GossipSub({
                enabled: true,
                emitSelf: false,
                allowPublishToZeroPeers: true,
            })
        })
    }

}
