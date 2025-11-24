import { Log } from "@ubccpsc310/project-support";
import Server from "./rest/Server";

Log.info("App - starting");
(async (): Promise<void> => {
	const port = 4321;
	const server = new Server(port);
	try {
		await server.start();
		Log.info(`server has started on ${port}`);
	} catch (err) {
		Log.error("Server failed to start");
	}
})();
