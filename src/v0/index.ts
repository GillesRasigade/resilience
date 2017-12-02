import * as cluster from "cluster";

import broker from "./broker";
import replica from "./replica";

(cluster.isMaster ? broker : replica)().catch(console.error);
