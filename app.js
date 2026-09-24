require('dotenv').config();

const helmet = require('helmet');
const express = require("express");
const path = require("path");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const sessionMiddleware = require('./src/config/session');
const { csrfContext } = require('./src/config/csrf');
const indexRouter = require("./routes/index");
const publicRoutes = require('./src/routes/public.routes');
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require('./src/routes/auth.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const userRoutes = require('./src/routes/user.routes');
const clientRoutes = require('./src/routes/client.routes');
const clientContactRoutes = require('./src/routes/client-contact.routes');
const clientInvestigationRoutes = require('./src/routes/client-investigation.routes');
const caseRoutes = require('./src/routes/case.routes');
const caseNoteRoutes = require('./src/routes/case-note.routes');
const caseDocumentRoutes = require('./src/routes/case-document.routes');
const caseReportRoutes = require('./src/routes/case-report.routes');
const investigationRoutes = require('./src/routes/investigation.routes');
const investigationRequestRoutes = require('./src/routes/investigation-request.routes');
const auditRoutes = require('./src/routes/audit.routes');

const app = express();

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net"
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.jsdelivr.net"
                ],

                imgSrc: [
                    "'self'",
                    "data:",
                    "https:"
                ],

                fontSrc: [
                    "'self'",
                    "data:",
                    "https://cdn.jsdelivr.net"
                ],

                connectSrc: [
                    "'self'"
                ],

                objectSrc: [
                    "'none'"
                ],

                baseUri: [
                    "'self'"
                ],

                formAction: [
                    "'self'"
                ],

                frameAncestors: [
                    "'self'"
                ]
            }
        },

        hsts: process.env.NODE_ENV === 'production'
    })
);

app.set("views", path.join(__dirname, "src", "views"));
app.set("view engine", "pug");

app.use(
    logger(
        process.env.NODE_ENV === 'production'
            ? 'combined'
            : 'dev'
    )
);

app.use(express.json({ limit: '100kb' }));

app.use(
    express.urlencoded({
        extended: true,
        limit: '100kb'
    })
);

app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));


app.use((req, res, next) => {

    res.locals.sessionUser = req.session.user || null;

    res.locals.isClientUser =
        Boolean(
            req.session.user &&
            req.session.user.clientId
        );

    res.locals.currentYear = new Date().getFullYear();

    res.locals.appName = 'NDUKA';

    res.locals.currentPath = req.path;

    res.locals.hasPermission = (permission) => {
        return Boolean(
            req.session.user &&
            Array.isArray(req.session.user.permissions) &&
            req.session.user.permissions.includes(permission)
        );
    };

    next();
});


// Routes
app.use(csrfContext);

app.use("/", indexRouter);
app.use(publicRoutes);

app.use(authRoutes);

app.use(dashboardRoutes);

app.use(userRoutes);

app.use(clientContactRoutes);
app.use(clientRoutes);
app.use(clientInvestigationRoutes);
app.use(caseRoutes);
app.use(caseNoteRoutes);
app.use(caseDocumentRoutes);
app.use(caseReportRoutes);
app.use(investigationRoutes);
app.use(investigationRequestRoutes);

app.use('/audit', auditRoutes);


// Error handling
app.use(notFound);

app.use(errorHandler);


module.exports = app;