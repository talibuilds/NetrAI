import { MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let prodPromise: Promise<MongoClient> | null = null;

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");
  return new MongoClient(uri).connect();
}

const clientPromise: Promise<MongoClient> = new Proxy(
  {} as Promise<MongoClient>,
  {
    get(_t, prop, receiver) {
      const target =
        process.env.NODE_ENV === "development"
          ? (global._mongoClientPromise ??= connect())
          : (prodPromise ??= connect());
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  },
);

export default clientPromise;
