"use strict";

import "mocha";
import chai from "chai";
import chaiPromised from "chai-as-promised";
import mockServer from "./support/mock-server";
import { config } from "dotenv";

config();
chai.use(chaiPromised);

before(mockServer.start);
after(mockServer.stop);
