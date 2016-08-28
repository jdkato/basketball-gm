const React = require('react');
const g = require('../../globals');
const ui = require('../../ui');
const league = require('../../core/league');
const bbgmViewReact = require('../../util/bbgmViewReact');
const helpers = require('../../util/helpers');

class EditTeamInfo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            dirty: false,
            saving: false,
            teams: this.props.teams,
        };
        this.handleFile = this.handleFile.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        if (!this.state.dirty) {
            this.setState({
                teams: nextProps.teams,
            });
        }
    }

    handleFile(e) {
        const file = e.target.files[0];

        const reader = new window.FileReader();
        reader.readAsText(file);
        reader.onload = async event => {
            const rosters = JSON.parse(event.target.result);
            const newTeams = rosters.teams;

            // Validate teams
            if (newTeams.length < g.numTeams) {
                console.log("ROSTER ERROR: Wrong number of teams");
                return;
            }
            for (let i = 0; i < newTeams.length; i++) {
                if (i !== newTeams[i].tid) {
                    console.log(`ROSTER ERROR: Wrong tid, team ${i}`);
                    return;
                }
                if (newTeams[i].cid < 0 || newTeams[i].cid > 1) {
                    console.log(`ROSTER ERROR: Invalid cid, team ${i}`);
                    return;
                }
                if (newTeams[i].did < 0 || newTeams[i].did > 5) {
                    console.log(`ROSTER ERROR: Invalid did, team ${i}`);
                    return;
                }
                if (typeof newTeams[i].region !== "string") {
                    console.log(`ROSTER ERROR: Invalid region, team ${i}`);
                    return;
                }
                if (typeof newTeams[i].name !== "string") {
                    console.log(`ROSTER ERROR: Invalid name, team ${i}`);
                    return;
                }
                if (typeof newTeams[i].abbrev !== "string") {
                    console.log(`ROSTER ERROR: Invalid abbrev, team ${i}`);
                    return;
                }

                // Check for pop in either the root or the most recent season
                if (!newTeams[i].hasOwnProperty("pop") && newTeams[i].hasOwnProperty("seasons")) {
                    newTeams[i].pop = newTeams[i].seasons[newTeams[i].seasons.length - 1].pop;
                }

                if (typeof newTeams[i].pop !== "number") {
                    console.log(`ROSTER ERROR: Invalid pop, team ${i}`);
                    return;
                }
            }

            let userName, userRegion;
            await g.dbl.tx(['teams', 'teamSeasons'], 'readwrite', tx => {
                return tx.teams.iterate(async t => {
                    t.cid = newTeams[t.tid].cid;
                    t.did = newTeams[t.tid].did;
                    t.region = newTeams[t.tid].region;
                    t.name = newTeams[t.tid].name;
                    t.abbrev = newTeams[t.tid].abbrev;
                    if (newTeams[t.tid].imgURL) {
                        t.imgURL = newTeams[t.tid].imgURL;
                    }

                    if (t.tid === g.userTid) {
                        userName = t.name;
                        userRegion = t.region;
                    }

                    const teamSeason = await tx.teamSeasons.index('season, tid').get([g.season, t.tid]);
                    teamSeason.pop = newTeams[t.tid].pop;
                    await tx.teamSeasons.put(teamSeason);

                    return t;
                });
            });

            await league.updateMetaNameRegion(userName, userRegion);

            await league.setGameAttributesComplete({
                teamAbbrevsCache: newTeams.map(t => t.abbrev),
                teamRegionsCache: newTeams.map(t => t.region),
                teamNamesCache: newTeams.map(t => t.name),
            });

            this.setState({
                dirty: false,
            });

            league.updateLastDbChange();
            ui.realtimeUpdate(["dbChange"]);
        };
    }

    handleInputChange(i, name, e) {
        // Mutating state, bad
        this.state.teams[i][name] = e.target.value;

        this.setState({
            dirty: true,
            teams: this.state.teams,
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.setState({
            dirty: false,
            saving: true,
        });

        let userName, userRegion;
        await g.dbl.tx(['teams', 'teamSeasons'], 'readwrite', tx => {
            return tx.teams.iterate(async t => {
                t.abbrev = this.state.teams[t.tid].abbrev;
                t.region = this.state.teams[t.tid].region;
                t.name = this.state.teams[t.tid].name;
                t.imgURL = this.state.teams[t.tid].imgURL;

                if (t.tid === g.userTid) {
                    userName = t.name;
                    userRegion = t.region;
                }

                const teamSeason = await tx.teamSeasons.index('season, tid').get([g.season, t.tid]);
                teamSeason.pop = parseFloat(this.state.teams[t.tid].pop);
                await tx.teamSeasons.put(teamSeason);

                return t;
            });
        });

        await league.updateMetaNameRegion(userName, userRegion);

        await league.setGameAttributesComplete({
            teamAbbrevsCache: this.state.teams.map(t => t.abbrev),
            teamRegionsCache: this.state.teams.map(t => t.region),
            teamNamesCache: this.state.teams.map(t => t.name),
        });

        league.updateLastDbChange();
        ui.realtimeUpdate([], helpers.leagueUrl(["edit_team_info"]));

        this.setState({
            dirty: false,
            saving: false,
        });
    }

    render() {
        bbgmViewReact.title('Edit Team Info');

        const {saving, teams = []} = this.state;

        return <div>
            <h1>Edit Team Info</h1>

            <p>You can manually edit the teams below or you can upload a teams file to specify all of the team info at once.</p>

            <h2>Upload Teams File</h2>

            <p>The JSON file format is described in <a href="http://basketball-gm.com/manual/customization/teams/">the manual</a>. As an example, you can download <a href="http://basketball-gm.com/files/old_teams.json" download>a teams file containing the old (pre-2014) default teams</a> or <a href="http://basketball-gm.com/files/new_teams.json" download>one containing the current default teams</a>.</p>

            <p className="text-danger">Warning: selecting a valid team file will instantly apply the new team info to your league.</p>

            <p><input type="file" onChange={e => this.handleFile(e)} /></p>

            <h2>Manual Editing</h2>

            <div className="row hidden-xs" style={{fontWeight: 'bold', marginBottom: '0.5em'}}>
                <div className="col-sm-2">
                    <br />Region
                </div>
                <div className="col-sm-2">
                    <br />Name
                </div>
                <div className="col-sm-2 col-md-1">
                    <br />Abbrev
                </div>
                <div className="col-sm-2">
                    Population<br />(millions)
                </div>
                <div className="col-sm-4 col-md-5">
                    <br />Logo URL
                </div>
            </div>

            <form onSubmit={this.handleSubmit} data-no-davis="true">
                <div className="row">
                    {teams.map((t, i) => <div key={t.tid}>
                        <div className="col-xs-6 col-sm-2 form-group">
                            <label className="visible-xs">Region</label>
                            <input type="text" className="form-control" onChange={this.handleInputChange.bind(this, i, 'region')} value={t.region} />
                        </div>
                        <div className="col-xs-6 col-sm-2 form-group">
                            <label className="visible-xs">Name</label>
                            <input type="text" className="form-control" onChange={this.handleInputChange.bind(this, i, 'name')} value={t.name} />
                        </div>
                        <div className="col-xs-6 col-sm-2 col-md-1 form-group">
                            <label className="visible-xs">Abbrev</label>
                            <input type="text" className="form-control" onChange={this.handleInputChange.bind(this, i, 'abbrev')} value={t.abbrev} />
                        </div>
                        <div className="col-xs-6 col-sm-2 form-group">
                            <label className="visible-xs">Population (millions)</label>
                            <input type="text" className="form-control" onChange={this.handleInputChange.bind(this, i, 'pop')} value={t.pop} />
                        </div>
                        <div className="col-sm-4 col-md-5 form-group">
                            <label className="visible-xs">Logo URL</label>
                            <input type="text" className="form-control" onChange={this.handleInputChange.bind(this, i, 'imgURL')} value={t.imgURL} />
                        </div>
                        <hr className="visible-xs" />
                    </div>)}
                </div>
                <center>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        Update Team Info
                    </button>
                </center>
            </form>
        </div>;
    }
}

module.exports = EditTeamInfo;