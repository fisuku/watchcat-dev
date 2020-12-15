import {Plugin, Stream} from "./plugin";

/**
 * Master list polling abstract class,
 * for small sites where grabbing a master list of streamers
 * every few minutes is feasible
 */
export abstract class PollingPlugin extends Plugin {
    public cache: Stream[] = [];

    cachedStream(username: string): Stream | null {
        return this.cache.filter((stream: Stream) => {
            return stream.username.toLowerCase() == username.toLowerCase();
        })[0];
    }

    collection() {
        return this.db.collection('state')
    }

    async main() {
        await this.poll();
        await this.collection().replaceOne({_id: this.id}, {streams: this.cache}, {upsert: true});
    }

    async ready() {
        const pollInterval = this.config?.pollInterval || 30000;

        const contents = await this.collection().findOne({_id: this.id});
        this.cache = (contents && contents.streams || []) as Stream[];
        this.log(`Resuming from previous state; ${this.cache.length} streams in store. Polling every ${pollInterval/1000}s`);

        await this.main()

        setInterval(async () => {
            await this.main();
        }, pollInterval)
    }

    contentsArrayToObject(contents: Stream[]): { [key: number]: Stream } {
        const map = {};

        contents.forEach((content: Stream) => {
            map[content.id] = content;
        });

        return map;
    }

    compare(oldContents, newContents) {
        const previous = this.contentsArrayToObject(oldContents);
        const current = this.contentsArrayToObject(newContents);

        // check added
        for (let key in current) {
            if (!previous[key]) {
                this.handlers.started(current[key])
            }
        }

        // check removed
        for (let key in previous) {
            if (!current[key]) {
                this.handlers.stopped(previous[key])
            }
        }
    }

    abstract poll()
}