/**
 * @module js-libp2p-webrtc-direct
 */
declare module "js-libp2p-webrtc-direct" {
    /**
     * @class
     */
    class WebRTCDirect {
        /**
         *
         * @param {*} ma
         * @param {object} options
         * @param {function} callback
         */
        dial(ma: any, options: any, callback: (...params: any[]) => any): void;
        /**
         *
         * @param {object} options
         * @param {function} handler
         */
        createListener(options: any, handler: (...params: any[]) => any): void;
        /**
         *
         * @param {*} multiaddrs
         */
        filter(multiaddrs: any): void;
    }
}

