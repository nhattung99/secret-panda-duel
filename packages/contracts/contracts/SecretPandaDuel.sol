// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract SecretPandaDuel is ZamaEthereumConfig {
    enum Phase { WaitingForOpponent, WaitingForMoves, WaitingForResult, Completed, Cancelled, Expired }
    enum Result { Draw, PlayerAWins, PlayerBWins, InvalidMove }

    uint64 public constant JOIN_WINDOW = 30 minutes;
    uint64 public constant MOVE_WINDOW = 15 minutes;
    uint256 public constant HISTORY_LIMIT = 20;
    uint256 private constant ROOM_CODE_COUNT = 9000;
    uint8 private constant ROUNDS_PER_MATCH = 3;
    uint8 private constant WINS_PER_MATCH = 2;
    uint8 public constant GAME_VERSION = 2;

    struct Room {
        address playerA;
        uint64 createdAt;
        Phase phase;
        Result result;
        bool submittedA;
        bool submittedB;
        address playerB;
        uint64 joinDeadline;
        address invitedOpponent;
        uint64 moveDeadline;
        uint64 endedAt;
        euint8 encryptedResult;
        uint256 rematchId;
    }

    struct Stats {
        uint256 wins;
        uint256 losses;
        uint256 draws;
    }

    struct MatchScore {
        uint8 played;
        uint8 winsA;
        uint8 winsB;
        Result[3] rounds;
    }

    error RoomNotFound();
    error WrongPhase();
    error NotParticipant();
    error NotCreator();
    error CannotJoin();
    error DeadlinePassed();
    error DeadlinePending();
    error AlreadySubmitted();
    error InputAlreadyUsed();
    error MissingInputProof();
    error RematchExists();
    error InvalidResult();
    error PageTooLarge();
    error RoomCodesExhausted();
    error WrongRound();
    error InvalidUsername();

    event RoomCreated(uint256 indexed roomId, address indexed playerA, address indexed invitedOpponent);
    event RoomJoined(uint256 indexed roomId, address indexed playerB);
    event MoveSubmitted(uint256 indexed roomId, address indexed player);
    event ResultReady(uint256 indexed roomId, bytes32 resultHandle);
    event RoundFinalized(uint256 indexed roomId, address indexed playerA, address indexed playerB, Result result);
    event MatchFinalized(uint256 indexed roomId, Result result);
    event UsernameUpdated(address indexed player, string username);
    event RoomCancelled(uint256 indexed roomId);
    event RoomExpired(uint256 indexed roomId);
    event RematchCreated(uint256 indexed previousRoomId, uint256 indexed roomId);

    uint256 public roomCount;
    mapping(uint256 => Room) private rooms;
    mapping(uint256 => euint8) private firstMoves;
    mapping(bytes32 => bool) private usedInputs;
    mapping(address => Stats) private stats;
    mapping(address => uint256[]) private completedRooms;
    mapping(uint256 => MatchScore) private matchScores;
    mapping(uint256 => uint256) private roomCodeSwaps;
    mapping(address => string) public usernames;

    function setUsername(string calldata username) external {
        bytes calldata name = bytes(username);
        if (name.length < 3 || name.length > 20) revert InvalidUsername();
        for (uint256 i; i < name.length; ++i) {
            bytes1 c = name[i];
            bool allowed = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A)
                || (c >= 0x61 && c <= 0x7A) || c == 0x5F;
            if (!allowed) revert InvalidUsername();
        }
        usernames[msg.sender] = username;
        emit UsernameUpdated(msg.sender, username);
    }

    function createRoom() external returns (uint256) {
        return _createRoom(address(0));
    }

    function createRematch(uint256 roomId) external returns (uint256 nextId) {
        Room storage room = _room(roomId);
        if (room.phase != Phase.Completed) revert WrongPhase();
        if (msg.sender != room.playerA && msg.sender != room.playerB) revert NotParticipant();
        if (room.rematchId != 0) revert RematchExists();

        address opponent = msg.sender == room.playerA ? room.playerB : room.playerA;
        nextId = _createRoom(opponent);
        room.rematchId = nextId;
        emit RematchCreated(roomId, nextId);
    }

    function joinRoom(uint256 roomId) external {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForOpponent) revert WrongPhase();
        if (block.timestamp >= room.joinDeadline) revert DeadlinePassed();
        if (msg.sender == room.playerA) revert CannotJoin();
        if (room.invitedOpponent != address(0) && msg.sender != room.invitedOpponent) revert CannotJoin();

        room.playerB = msg.sender;
        room.moveDeadline = uint64(block.timestamp) + MOVE_WINDOW;
        room.phase = Phase.WaitingForMoves;
        emit RoomJoined(roomId, msg.sender);
    }

    function submitMove(uint256 roomId, externalEuint8 encryptedMove, bytes calldata inputProof) external {
        _submitMove(roomId, 1, encryptedMove, inputProof);
    }

    function submitRoundMove(uint256 roomId, uint8 round, externalEuint8 encryptedMove, bytes calldata inputProof) external {
        _submitMove(roomId, round, encryptedMove, inputProof);
    }

    function _submitMove(uint256 roomId, uint8 round, externalEuint8 encryptedMove, bytes calldata inputProof) private {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForMoves) revert WrongPhase();
        if (round != matchScores[roomId].played + 1) revert WrongRound();
        if (block.timestamp >= room.moveDeadline) revert DeadlinePassed();

        bool isA = msg.sender == room.playerA;
        if (!isA && msg.sender != room.playerB) revert NotParticipant();
        if (isA ? room.submittedA : room.submittedB) revert AlreadySubmitted();
        if (inputProof.length == 0) revert MissingInputProof();

        bytes32 inputHandle = externalEuint8.unwrap(encryptedMove);
        if (usedInputs[inputHandle]) revert InputAlreadyUsed();
        euint8 move = FHE.fromExternal(encryptedMove, inputProof);
        usedInputs[inputHandle] = true;

        if (isA) room.submittedA = true;
        else room.submittedB = true;
        emit MoveSubmitted(roomId, msg.sender);

        if (!room.submittedA || !room.submittedB) {
            firstMoves[roomId] = move;
            FHE.allowThis(move);
            return;
        }

        euint8 first = firstMoves[roomId];
        firstMoves[roomId] = euint8.wrap(bytes32(0));
        euint8 outcome = isA ? _evaluate(move, first) : _evaluate(first, move);
        room.encryptedResult = outcome;
        room.phase = Phase.WaitingForResult;
        FHE.makePubliclyDecryptable(outcome);
        emit ResultReady(roomId, euint8.unwrap(outcome));
    }

    function finalizeRound(uint256 roomId, uint8 outcome, bytes calldata proof) external {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForResult) revert WrongPhase();
        if (outcome > uint8(Result.InvalidMove)) revert InvalidResult();

        bytes32[] memory handles = new bytes32[](1);
        handles[0] = euint8.unwrap(room.encryptedResult);
        FHE.checkSignatures(handles, abi.encode(outcome), proof);

        Result result = Result(outcome);
        MatchScore storage score = matchScores[roomId];
        score.rounds[score.played++] = result;
        if (result == Result.PlayerAWins) score.winsA++;
        if (result == Result.PlayerBWins) score.winsB++;
        emit RoundFinalized(roomId, room.playerA, room.playerB, result);

        if (result == Result.InvalidMove) {
            _completeMatch(roomId, room, result);
        } else if (score.winsA == WINS_PER_MATCH) {
            _completeMatch(roomId, room, Result.PlayerAWins);
        } else if (score.winsB == WINS_PER_MATCH) {
            _completeMatch(roomId, room, Result.PlayerBWins);
        } else if (score.played == ROUNDS_PER_MATCH) {
            _completeMatch(roomId, room, Result.Draw);
        } else {
            room.phase = Phase.WaitingForMoves;
            room.submittedA = false;
            room.submittedB = false;
            room.encryptedResult = euint8.wrap(bytes32(0));
            room.moveDeadline = uint64(block.timestamp) + MOVE_WINDOW;
        }
    }

    function _completeMatch(uint256 roomId, Room storage room, Result result) private {
        room.result = result;
        room.phase = Phase.Completed;
        room.endedAt = uint64(block.timestamp);
        completedRooms[room.playerA].push(roomId);
        completedRooms[room.playerB].push(roomId);
        if (result == Result.Draw) {
            stats[room.playerA].draws++;
            stats[room.playerB].draws++;
        } else if (result == Result.PlayerAWins) {
            stats[room.playerA].wins++;
            stats[room.playerB].losses++;
        } else if (result == Result.PlayerBWins) {
            stats[room.playerB].wins++;
            stats[room.playerA].losses++;
        }
        emit MatchFinalized(roomId, result);
    }

    function cancelRoom(uint256 roomId) external {
        Room storage room = _room(roomId);
        if (room.phase != Phase.WaitingForOpponent) revert WrongPhase();
        if (msg.sender != room.playerA) revert NotCreator();
        if (block.timestamp >= room.joinDeadline) revert DeadlinePassed();

        room.phase = Phase.Cancelled;
        room.endedAt = uint64(block.timestamp);
        emit RoomCancelled(roomId);
    }

    function expireRoom(uint256 roomId) external {
        Room storage room = _room(roomId);
        uint64 deadline;
        if (room.phase == Phase.WaitingForOpponent) deadline = room.joinDeadline;
        else if (room.phase == Phase.WaitingForMoves) deadline = room.moveDeadline;
        else revert WrongPhase();
        if (block.timestamp < deadline) revert DeadlinePending();

        firstMoves[roomId] = euint8.wrap(bytes32(0));
        room.phase = Phase.Expired;
        room.endedAt = uint64(block.timestamp);
        emit RoomExpired(roomId);
    }

    function getRoom(uint256 roomId) external view returns (Room memory) {
        return _room(roomId);
    }

    function getMatchRoom(uint256 roomId) external view returns (Room memory room, MatchScore memory score) {
        return (_room(roomId), matchScores[roomId]);
    }

    function getPlayerStats(address player) external view returns (Stats memory) {
        return stats[player];
    }

    function getRecentMatches(address player, uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        if (limit > HISTORY_LIMIT) revert PageTooLarge();

        uint256[] storage history = completedRooms[player];
        uint256 end = history.length;
        if (offset >= end) return new uint256[](0);
        end -= offset;
        uint256 count = limit < end ? limit : end;
        ids = new uint256[](count);
        for (uint256 i; i < count; ++i) ids[i] = history[end - 1 - i];
    }

    function _createRoom(address opponent) private returns (uint256 roomId) {
        uint256 remaining = ROOM_CODE_COUNT - roomCount;
        if (remaining == 0) revert RoomCodesExhausted();
        // Draw from a sparse Fisher–Yates pool so codes are never reused.
        // Room codes are public identifiers and confer no join permissions.
        uint256 index = uint256(keccak256(abi.encode(block.prevrandao, address(this), msg.sender, roomCount))) % remaining;
        uint256 last = remaining - 1;
        roomId = _codeAt(index);
        if (index != last) roomCodeSwaps[index] = _codeAt(last);
        delete roomCodeSwaps[last];
        ++roomCount;
        Room storage room = rooms[roomId];
        room.playerA = msg.sender;
        room.invitedOpponent = opponent;
        room.createdAt = uint64(block.timestamp);
        room.joinDeadline = room.createdAt + JOIN_WINDOW;
        emit RoomCreated(roomId, msg.sender, opponent);
    }

    function _codeAt(uint256 index) private view returns (uint256) {
        uint256 code = roomCodeSwaps[index];
        return code == 0 ? index + 1000 : code;
    }

    function _room(uint256 roomId) private view returns (Room storage room) {
        room = rooms[roomId];
        if (room.playerA == address(0)) revert RoomNotFound();
    }

    function _evaluate(euint8 a, euint8 b) private returns (euint8) {
        ebool valid = FHE.and(FHE.le(a, uint8(2)), FHE.le(b, uint8(2)));
        // With valid inputs, A wins when (a - b) is 1 or -2. euint8 wraps -2 to 254.
        euint8 difference = FHE.sub(a, b);
        ebool aWins = FHE.or(FHE.eq(difference, uint8(1)), FHE.eq(difference, uint8(254)));
        euint8 winner = FHE.select(aWins, FHE.asEuint8(1), FHE.asEuint8(2));
        euint8 result = FHE.select(FHE.eq(difference, uint8(0)), FHE.asEuint8(0), winner);
        return FHE.select(valid, result, FHE.asEuint8(3));
    }
}
